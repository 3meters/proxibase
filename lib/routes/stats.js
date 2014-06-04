/**
 * /routes/stats
 *
 *    Get link counts from the calculated tos and froms link count collections.
 *
 *    These collections are stored in mongodb map-reduce format so that they can
 *    be incrementally reduced as new links are added.  The link counts are bucketed
 *    by direction by type to an object and from an object by day.
 *
 *    See: http://docs.mongodb.org/manual/tutorial/perform-incremental-map-reduce
 *
 *    This function accepts queries to those collections, and then uses mongodb's
 *    aggregation framework (http://docs.mongodb.org/manual/core/aggregation-pipeline)
 *    to  over those collections.
 */

exports.addRoutes = function(app) {
  app.get ('/stats', welcome)
  app.get ('/stats/refresh', refreshAll)
  app.get ('/stats/rebuild', rebuildAll)
  app.all ('/stats/to/?*', setTo)
  app.all ('/stats/from/?*', setFrom)
  app.get ('/stats/:direction(to|from)/refresh', refresh)
  app.get ('/stats/:direction(to|from)/rebuild', rebuild)
  app.post('/stats/to/:clToName?', getRest)
  app.get ('/stats/to/:clToName?', getRest)
  app.post('/stats/from/:clFromName?', getRest)
  app.get ('/stats/from/:clFromName?', getRest)
  app.post('/stats/to/:clToName/from/:clFromName', getRest)
  app.get ('/stats/to/:clToName/from/:clFromName', getRest)
  app.post('/stats/from/:clFromName/to/:clToName', getRest)
  app.get ('/stats/from/:clFromName/to/:clToName', getRest)
}

function welcome(res, res) {
  res.send({info: {
    paths: {
      1: '/stats/to/<collection>',
      2: '/stats/to/<collection/from/<collection>',
      3: '/stats/from/<collection>',
      4: '/stats/from/<collection>/to/<collection>',
    },
    params: bodySpec,
  }})
}

function setTo(req, res, next) {
  req.collection = db.safeCollection('tos')
  next()
}

function setFrom(req, res, next) {
  req.collection = db.safeCollection('froms')
  next()
}


function refresh(req, res) {
  req.collection.refresh(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}


function rebuild(req, res) {
  req.collection.rebuild(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}


function refreshAll(req, res) {
  db.tos.refresh(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.refresh(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({to: toResults, from: fromResults})
    })
  })
}

function rebuildAll(req, res) {
  db.tos.rebuild(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.rebuild(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({to: toResults, from: fromResults})
    })
  })
}

var bodySpec = {
  type:       {type: 'string'},
  day:        {type: 'string'},
  name:       {type: 'string', comment: 'any word in namelc starts with, case-insensitve'},
  _category:  {type: 'string'},
  // location:   {type: 'string|object'},  NYI
  query:      {type: 'object', comment: 'pass through to underlying reduced-format schema'},
  sort:       {type: 'object|array|string'},
  limit:      {type: 'number', default: 50}, // util.statics.db.limits.default},
  skip:       {type: 'number', default: 0},
  log:        {type: 'boolean|string|number', comment: 'include query in result'},
}


// Public rest front-end for run
function getRest(req, res) {

  var options = req.body
  options.collection = req.collection
  options.collectionName = req.collection.collectionName
  options.clToName = req.params.clToName
  options.clFromName = req.params.clFromName
  options.dbOps = req.dbOps

  run(options, function(err, results, meta) {
    if (err) return res.error(err)
    var out = {data: results}
    for (var key in meta) {
      out[key] = meta[key]
    }
    res.send(out)
  })
}


// Main worker, can be called directly by trusted code
function run(options, cb) {

  var aggOps = []
  var clName = options.collectionName
  var clToName = options.clToName
  var clFromName = options.clFromName
  var clTo, clFrom

  // validate the to collection
  if (clToName) {
    clTo = db.safeCollection(clToName)
    if (!clTo) return cb(perr.notFound('Unknown collection ' + clToName))
  }

  // validate the from collection
  if (clFromName) {
    clFrom = db.safeCollection(options.clFromName)
    if (!clFrom) return cb(perr.notFound('Unknown collection ' + clFromName))
  }

  // scrub
  var err = scrub(options, bodySpec)
  if (err) return cb(err)

  var logQuery = tipe.isTruthy(options.log)


  // $geoNear:  NYI as this requires special work for mongos
  // aggregation framework, but the parsing code is still valid
  if (options.location) {
    var lat, lng

    if (tipe.isString(options.location)) {
      var ll = options.location.split(',')
      if (ll.length === 2) {
        lat = ll[0]
        lng = ll[1]
      }
    }
    else {
      lat = options.location.lat
      lng = options.location.lng
    }

    if (!(lat && lng)) return cb(perr.badParam('location'))

    // TODO: implement

  }


  /* $match
   *
   *  The underlying collection being queried is stored in reduced format so that
   *  it can be incrmentally reduced.
   *
   *  {
   *    _id: {
   *      toSchema:
   *      fromSchema:
   *      type:
   *      day:
   *      _to|_from:
   *    },
   *    value:
   *
   *    // plus some properties we add in /schemas/_linkstats/refresh:
   *
   *    namelc:
   *    _category:
   *    location:
   *  }
   *
   *  This block of code enables callers to query the tos and froms collections as
   *  if they were stored like so:
   *
   *  {
   *    toSchema:
   *    fromSchema:
   *    type:
   *    day:
   *    name:
   *    _category:
   *    location:
   *  }
   *
   */

  var filters = []

  // _id.toSchema
  if (clTo) {
    filters.push({'_id.toSchema': clTo.schema.name})
  }

  // _id.fromSchema
  if (clFrom) {
    filters.push({'_id.fromSchema': clFrom.schema.name})
  }

  // _id.type and _id.day
  ;['type', 'day'].forEach(function(filter) {
    if (options[filter]) {
      var _idFilter = {}
      _idFilter['_id.' + filter] = options[filter]
      filters.push(_idFilter)
    }
  })

  // Pass through query unmodified.  This is for callers who understand the
  // underlying reduced schema and want to query it directly without sugar.
  if (options.query) {
    filters.push(options.query)
  }

  // _category
  if (options._category) {
    filters.push({_category: options._category})
  }

  // name
  if (options.name) {
    filters.push({namelc: {$regex: '\\b' + options.name.toLowerCase()}})  // any word begining with name
  }

  // Wrap all the filters in an $and
  if (filters.length) aggOps.push({$match: {$and: filters}})


  // $group
  var group = {
    _id: (clName === 'tos') ? '$_id._to' : '$_id._from',
    value: {$sum: '$value'},
  }
  if ('tos' === clName) group.toSchema = {$first: '$_id.toSchema'}
  else group.fromSchema = {$first: '$_id.fromSchema'}
  aggOps.push({$group: group})


  // $sort, $limit, $skip
  var sort = options.sort || {value: -1, '_id.day': -1}
  aggOps.push({$sort: sort})
  aggOps.push({$limit: options.limit})
  aggOps.push({$skip: options.skip})


  // $project
  var project = {count: '$value'}
  if ('tos' === clName) {
    project._to = '$_id'
    project.toSchema = '$toSchema'
  }
  else {
    project._from = '$_id'
    project.fromSchema = '$fromSchema'
  }
  aggOps.push({$project: project})


  if (logQuery) log(clName + ' aggregate options:', aggOps)


  // do it
  options.collection.aggregate(aggOps, function(err, aggResults) {
    if (err) return cb(err)

    // get referenced data from base documents
    var decorateOps = {
      asAdmin: true,
      refs: 'name,photo,category,location',
      datesToUTC: options.datesToUTC,
    }

    options.collection.decorate(aggResults, decorateOps, function(err, raggedDocs) {
      if (err) return cb(err)

      // flatten the stored reduced-format collection into an array
      var rank = 1
      var docs = raggedDocs.map(function(ragged) {
        var ent = ragged.to || ragged.from || {}
        return {
          _id: ragged._id,
          name: ent.name,
          schema: ragged.toSchema || ragged.fromSchema,
          photo: ent.photo,
          category: ent.category,
          location: ent.location,
          count: ragged.count,
          rank: rank++,
        }
      })

      // add metadata
      var meta = {}
      if (logQuery) {
        meta.query = {}
        meta.query[clName + '.aggregate'] = aggOps
      }

      // done
      cb(null, docs, meta)
    })
  })
}


// To support calling from the deprecated api /do/countLinks
exports.to = getRest
exports.from = getRest
