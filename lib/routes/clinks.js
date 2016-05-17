/**
 * /routes/clinks
 *
 * Count links cached in the the linkstats collection
 */


exports.addRoutes = function(app) {
  app.delete('/clinks/?*', fail)
  app.get('/clinks', welcome)
  app.get('/clinks/rebuild', rebuild)
  app.all('/clinks/to/?*', setTo)
  app.all('/clinks/from/?*', setFrom)
  app.all('/clinks/to/:cl_or_id/from/:cl_or_id2', get)
  app.all('/clinks/from/:cl_or_id/to/:cl_or_id2', get)
  app.all('/clinks/to/:cl_or_id?', get)
  app.all('/clinks/from/:cl_or_id?', get)
}


function fail(req, res) {
  res.error(perr.forbidden())
}


function welcome(req, res) {
  res.send({info: {
    comment: 'Sample endpoints for getting link statistics',
    paths: {
      0: '/clinks/to/<collection>?type=content',
      1: '/clinks/to/<collection/from/<collection>?type=watch&enabled=1',
      2: '/clinks/to/<_id>?type=content',
      3: '/clinks/to/<_id>/from/<collection>?type=content',
    },
  }})
}


function rebuild(req, res) {
  if (!req.asAdmin) return res.error(perr.badAuth())
  db.linkStats.rebuild(req.dbOps, function(err, meta) {
    if (err) return res.error(err)
    res.send(meta || {})
  })
}


function setTo(req, res, next) {
  req.body.dirTo = true
  next()
}


function setFrom(req, res, next) {
  req.body.dirTo = false
  next()
}


var spec = {
  dirTo:        {type: 'boolean'},
  clName:       {type: 'string', required: true},
  schemaName:   {type: 'string'},
  id:           {type: 'string'},
  clName2:      {type: 'string'},
  schemaName2:  {type: 'string'},
  id2:          {type: 'string'},
  type:         {type: 'string'},
  enabled:      {type: 'boolean'},
  fields:       {type: 'string', default: 'name', value: validFields},
  more:         {type: 'boolean'},
  sort:         {type: 'object', default: {count: -1, modifiedDate: -1}},
  skip:         {type: 'number', default: 0},
  limit:        {type: 'number', default: 20, value: function(v) {return Math.min(v, 100)}},
  log:          {type: 'boolean'},
}


// Whitelist valid fields to include in results
function validFields(v) {
  var outFields = []
  var legal = {name: 1, area: 1, photo: 1, type: 1, category: 1, visibility: 1}
  var inFields = v.split(',')
  inFields.forEach(function(f) { if (legal[f]) outFields.push(f) })
  return outFields.join(',')
}


// Public rest front-end for get
function get(req, res) {
  var options = _.assign({}, req.query, req.body, req.params)
  run(options, req.dbOps, function(err, results, meta) {
    if (err) return res.error(err)
    res.send(_.assign({data: results}, meta))
  })
}


// Main worker
function run(ops, dbOps, cb) {

  // Figure out clName
  if (statics.collections[ops.cl_or_id]) ops.clName = ops.cl_or_id
  if (!ops.clName) {
    ops.clName = util.clNameFromId(ops.cl_or_id)
    if (tipe.isError(ops.clName)) return cb(perr.badValue(ops.cl_or_id))
    ops.id = ops.cl_or_id
  }

  // Figure out clName2
  if (ops.cl_or_id2) {
    if (statics.collections[ops.cl_or_id2]) ops.clName2 = ops.cl_or_id2
    if (!ops.clName2) {
      ops.clName2 = util.clNameFromId(ops.cl_or_id2)
      if (tipe.isError(ops.clName2)) return cb(perr.badValue(ops.cl_or_id2))
      ops.id2 = ops.cl_or_id2
    }
  }

  ops.schemaName = statics.collections[ops.clName].schema
  if (ops.clName2) {
    ops.schemaName2 = statics.collections[ops.clName2].schema
  }

  delete ops.cl_or_id
  delete ops.cl_or_id2

  // Scrub
  var err = scrub(ops, spec)
  if (err) return cb(err)

  var aggOps = []   // mongodb aggregation query options
  var filters = []

  if (ops.dirTo) {
    if (ops.clName)   filters.push({toSchema: ops.schemaName})
    if (ops.id)       filters.push({_to: ops.id})
    else              filters.push({_to: {$exists: true}})
    if (ops.clName2)  filters.push({fromSchema: ops.schemaName2})
    if (ops.id2)      filters.push({_from: ops.id2})
  }
  else {
    if (ops.clName)   filters.push({fromSchema: ops.schemaName})
    if (ops.id)       filters.push({_from: ops.id})
    else              filters.push({_from: {$exists: true}})
    if (ops.clName2)  filters.push({toSchema: ops.schemaName2})
    if (ops.id2)      filters.push({_to: ops.id2})
  }

  if (ops.type) filters.push({type: ops.type})
  if (tipe.isDefined(ops.enabled)) filters.push({enabled: ops.enabled})

  // Wrap all the filters in an $and
  if (filters.length) aggOps.push({$match: {$and: filters}})

  // $group
  aggOps.push({$group: {
    _id: ops.dirTo ? '$_to' : '$_from',
    count: {$sum: '$count'},
  }})

  // $sort, $limit, $skip, $more
  // Note that unlike with regular find, the order matters
  if (ops.more)  ops.limit++
  if (ops.sort)  aggOps.push({$sort: ops.sort})
  else           aggOps.push({$sort: {count: -1}})
  if (ops.limit) aggOps.push({$limit: ops.limit})
  if (ops.skip)  aggOps.push({$skip: ops.skip})


  // Run the aggregate query
  db.linkstats.aggregate(aggOps, function(err, aggResults, meta) {
    if (err) return cb(err)
    meta = meta || {}

    // More for paging
    if (aggResults.length >= ops.limit && ops.more) {
      aggResults.pop()
      ops.limit--
      meta.more = true
    }

    // Build an array of result _ids and a map of aggResults by _id
    var _ids = []
    var resultMap = {}
    aggResults.forEach(function(result) {
      _ids.push(result._id)
      resultMap[result._id] = result
    })

    // Find the requested fields from the top-level docs to add to the agg results
    dbOps.fields = ops.fields
    db[ops.clName].safeFind({_id: {$in: _ids}}, dbOps, function(err, docs) {
      if (err) return cb(err)

      docs.forEach(function(doc) {
        delete doc._owner                 // safeFind default field
        _.assign(resultMap[doc._id], doc)
      })

      // Return results in the original sort order
      var aggResultsExt = []
      _ids.forEach(function(_id) {
        aggResultsExt.push(resultMap[_id])
      })

      cb(null, aggResultsExt, meta)
    })
  })
}


exports.get = get
exports.run = run
