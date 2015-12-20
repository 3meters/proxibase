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
  dirTo:      {type: 'boolean'},
  clName:     {type: 'string', required: true},
  id:         {type: 'string'},
  clName2:    {type: 'string'},
  id2:        {type: 'string'},
  type:       {type: 'string'},
  enabled:    {type: 'boolean'},
  more:       {type: 'boolean'},
  sort:       {type: 'object', default: {count: -1, modifiedDate: -1}},
  skip:       {type: 'number', default: 0},
  limit:      {type: 'number', default: 20, value: function(v) {return Math.min(v, 100)}},
  log:        {type: 'boolean'},
}


// Public rest front-end for get
function get(req, res) {

  var options = _.assign({}, req.query, req.body, req.params, req.dbOps)
  run(options, function(err, results, meta) {
    if (err) return res.error(err)
    res.send(_.assign({data: results}, meta))
  })
}


// Main worker
function run(options, cb) {

  var clName, clName2, id, id2, schemaName, schemaName2

  clName = statics.safeCollections(options.cl_or_id)
  if (!clName) {
    clName = util.clNameFromId(options.cl_or_id)
    if (tipe.isError(clName)) return cb(perr.badValue(options.cl_or_id))
    id = options.cl_or_id
  }
  if (options.cl_or_id2) {
    clName2 = statics.safeCollections(options.cl_or_id2)
    if (clName) options.clName2 = clName
    else {
      clName2 = util.clNameFromId(options.cl_or_id2)
      if (tipe.isError(clName2)) return cb(perr.badValue(options.cl_or_id2))
      id2 = options.cl_or_id2
    }
  }
  delete options.cl_or_id
  delete options.cl_or_id2

  schemaName = statics.safeCollections[clName].schema.name
  if (clName2) {
    schemaName2 = statics.safeCollections[clName2].schema.name
  }

  // Scrub
  var err = scrub(options, spec)
  if (err) return cb(err)

  var aggOps = []   // mongodb aggregation query options
  var filters = []

  if (options.dirTo) {
    if (clName)   filters.push({toSchema: schemaName})
    if (id)       filters.push({_to: id})
    else          filters.push({_to: {$exists: true}})
    if (clName2)  filters.push({fromSchema: schemaName2})
    if (id2)      filters.push({_from: id2})
    else          filters.push({_from: {$exists: true}})
  }
  else {
    if (clName)   filters.push({fromSchema: schemaName})
    if (id)       filters.push({_from: id})
    else          filters.push({_from: {$exists: true}})
    if (clName2)  filters.push({toSchema: schemaName2})
    if (id2)      filters.push({_to: id2})
    else          filters.push({_to: {$exists: true}})
  }

  if (options.type) filters.push({type: options.type})
  if (tipe.isDefined(options.enabled)) filters.push({enabled: options.enabled})

  // Wrap all the filters in an $and
  if (filters.length) aggOps.push({$match: {$and: filters}})

  // $group
  aggOps.push({$group: {count: {$sum: '$count'}}})


  // $sort, $limit, $skip, $more
  // Note that unlike with regular find, the order matters
  if (options.more)  options.limit++
  if (options.sort) aggOps.push({$sort: options.sort})
  if (options.skip)  aggOps.push({$skip: options.skip})
  if (options.limit) aggOps.push({$limit: options.limit})

  // Run the aggregate query
  db.linkstats.aggregate(aggOps, function(err, aggResults, meta) {
    if (err) return cb(err)
    meta = meta || {}

    // More for paging
    if (aggResults.length >= options.limit && options.more) {
      aggResults.pop()
      options.limit--
      meta.more = true
    }

    cb(null, aggResults, meta)
  })
}


exports.get = get
