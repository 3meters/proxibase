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

var async = require('async')

exports.addRoutes = function(app) {
  app.get ('/stats', welcome)
  app.get ('/stats/refresh', refresh)
  app.get ('/stats/rebuild', rebuild)
  app.all ('/stats/to/?*', setTo)
  app.all ('/stats/from/?*', setFrom)
  app.get ('/stats/to/:clToName?', getRest)
  app.post('/stats/to/:clToName?', getRest)
  app.get ('/stats/from/:clFromName?', getRest)
  app.post('/stats/from/:clFromName?', getRest)
  app.get ('/stats/to/:clToName/from/:clFromName', getRest)
  app.post('/stats/to/:clToName/from/:clFromName', getRest)
  app.get ('/stats/from/:clFromName/to/:clToName', getRest)
  app.post('/stats/from/:clFromName/to/:clToName', getRest)
  app.get ('/stats/to/:clToName/:docId', getRest)
  app.post('/stats/to/:clToName/:docId', getRest)
  app.get ('/stats/from/:clFromName/:docId', getRest)
  app.post('/stats/from/:clFromName/:docId', getRest)
}


function welcome(req, res) {
  res.send({info: {
    comment: 'Sample endpoints for getting link statistics',
    paths: {
      0: '/stats',
      1: '/stats/to/<collection>?type=content',
      2: '/stats/to/<collection/from/<collection>?type=watch',
      3: '/stats/from/<collection>?day=150302',
      4: '/stats/from/<collection>/to/<collection>/<docId>',
    },
    params: statSpec,
  }})
}


function setTo(req, res, next) {
  req.body.clStatName = 'tos'
  next()
}


function setFrom(req, res, next) {
  req.body.clStatName = 'froms'
  next()
}


function refresh(req, res) {
  db.tos.refresh(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.refresh(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({to: toResults, from: fromResults})
    })
  })
}


function rebuild(req, res) {
  db.tos.rebuild(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.rebuild(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({to: toResults, from: fromResults})
    })
  })
}


var statSpec = {
  clStatName: {type: 'string', required: true},
  clToName:   {type: 'string', validate: validateClName},
  clFromName: {type: 'string', validate: validateClName},
  docId:      {type: 'string'},
  type:       {type: 'string'},
  name:       {type: 'string', comment: 'Any word in namelc starts with, case-insensitve'},
  day:        {type: 'string', comment: 'YYMMDD, use with $gt, $lt operators'},
  location:   {type: 'string|object'},  // NYI
  more:       {type: 'boolean'},
  sort:       {type: 'object', strict: false, default: {count: -1, recent: -1, _id: 1}},
  skip:       {type: 'number', default: 0},
  limit:      {type: 'number', default: 20, value: function(v) {return Math.min(v, 100)}},
  log:        {type: 'boolean|string|number', comment: 'Include diagnostics in result'},
}


// Ensure known collection
function validateClName(v) {
  if (!statics.collections[v]) return 'Unknown collection ' + v
}


// Public rest front-end for get
function getRest(req, res) {

  var options = _.assign(req.body, req.params, req.dbOps)

  get(options, function(err, results, meta) {
    if (err) return res.error(err)
    res.send(_.assign({data: results}, meta))
  })
}


// Main worker, can be called directly by trusted code
function get(options, cb) {

  var statOps = {}  // options to build out stats query
  var aggOps = []   // mongodb aggregation query options
  var findOps = {}  // find options to look up documents after aggregations

  // Options specified by statSpec are harvested, the rest become find options
  for (var key in statSpec) { if (options[key]) statOps[key] = options[key] }
  for (key in options) { if (!statSpec[key]) findOps[key] = options[key] }

  var err = scrub(statOps, statSpec)
  if (err) return cb(err)

  var clStatName = statOps.clStatName
  var clToName = statOps.clToName
  var clFromName = statOps.clFromName
  var clTo = db.safeCollection(clToName)
  var clFrom = db.safeCollection(clFromName)
  var logQuery = tipe.isTruthy(statOps.log)

  // $geoNear:  NYI as this requires special work for mongos
  // aggregation framework, but the parsing code is still valid
  if (statOps.location) {
    var lat, lng

    if (tipe.isString(statOps.location)) {
      var ll = statOps.location.split(',')
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
   *      _to|_from:
   *      toSchema:
   *      fromSchema:
   *      type:
   *      day:
   *    },
   *    value:
   *
   *    // plus some properties we add in /schemas/_linkstats/refresh:
   *
   *    namelc:
   *    _category:
   *    location:
   *    visibility:
   *  }
   *
   *  This block of code enables callers to query the tos and froms collections as
   *  if they were stored like so:
   *
   *  {
   *    _to|_from:
   *    toSchema:
   *    fromSchema:
   *    type:
   *    day:
   *    name:
   *    _category:
   *    location:  (NYI)
   *  }
   *
   */

  var filters = []

  // _id.toSchema
  if (clTo) {
    filters.push({'_id.toSchema': clTo.schema.name})
    if (statOps.docId) filters.push({'_id._to': statOps.docId})
  }

  // _id.fromSchema
  if (clFrom) {
    filters.push({'_id.fromSchema': clFrom.schema.name})
    if (statOps.docId) filters.push({'_id._from': statOps.docId})
  }

  // _id.type and _id.day
  ;['type', 'day'].forEach(function(filter) {
    var idFilter = {}
    if (statOps[filter]) {
      idFilter['_id.' + filter] = statOps[filter]
      filters.push(idFilter)
    }
  })

  // name
  if (statOps.name) {
    filters.push({namelc: {$regex: '\\b' + statOps.name.toLowerCase()}})  // any word begining with name
  }

  // Wrap all the filters in an $and
  if (filters.length) aggOps.push({$match: {$and: filters}})


  // $group
  var group = {
    _id: (clStatName === 'tos') ? '$_id._to' : '$_id._from',
    value: {$sum: '$value'},
    recent: {$max: '$_id.day'},
  }
  if ('tos' === clStatName) group.toSchema = {$first: '$_id.toSchema'}
  else group.fromSchema = {$first: '$_id.fromSchema'}
  aggOps.push({$group: group})

  // $project
  var project = {count: '$value', recent: '$recent'}
  if ('tos' === clStatName) project.toSchema = '$toSchema'
  else project.fromSchema = '$fromSchema'
  aggOps.push({$project: project})


  // $sort, $limit, $skip, $more
  // Note that unlike with regular find, the order matters
  if (statOps.more)  statOps.limit++
  if (statOps.sort) aggOps.push({$sort: statOps.sort})
  if (statOps.skip)  aggOps.push({$skip: statOps.skip})
  if (statOps.limit) aggOps.push({$limit: statOps.limit})

  if (logQuery) log(clStatName + ' aggregate options:', aggOps)

  // Run the aggregate query against the tos or froms collection
  db[clStatName].aggregate(aggOps, processAggResults)

  function processAggResults(err, aggResults, meta) {
    if (err) return cb(err)
    meta = meta || {}

    // Implement more for paging
    if (aggResults.length >= statOps.limit && statOps.more) {
      aggResults.pop()
      statOps.limit--
      meta.more = true
    }

    var aggMap = {}
    aggResults.forEach(function(agg) {
      var schema = agg.fromSchema || agg.toSchema
      aggMap[schema] = aggMap[schema] || {}
      aggMap[schema][agg._id] = {count: agg.count, recent: agg.recent}
    })

    async.eachSeries(Object.keys(aggMap), getDocs, finish)

    function getDocs(schema, nextSchema) {

      var clName = db.safeSchema(schema).collection

      var query = {_id: {$in: Object.keys(aggMap[schema])}}

      // Tailor document find options for a detail look-up
      findOps.limit = statics.db.limits.max
      delete findOps.sort
      delete findOps.skip
      delete findOps.more
      delete findOps.query

      db[clName].safeFind(query, findOps, function(err, docs) {
        if (err) return nextSchema(err)

        docs.forEach(function(doc) {
          aggMap[schema][doc._id].doc = doc
        })

        nextSchema()
      })
    }

    function finish(err) {
      if (err) return cb(err)

      var rank = 1
      var results = []
      aggResults.forEach(function(agg) {
        var schema = agg.toSchema || agg.fromSchema
        var result = aggMap[schema][agg._id]

        // Since we are using safeFind, rather than safeFindOne to look up documents,
        // It is possible that the results will include messages that a user my have
        // permission to see via their membership in a patch that they cannot see here.
        // If this becomes a problem we can switch to safeFindOne on each result, but
        // at some performance penalty.
        if (result) {
          result.doc.count = result.count
          result.doc.recent = result.recent
          result.doc.rank = rank++
          results.push(result.doc)
        }
      })

      // Add metadata
      if (logQuery) {
        meta.query = {}
        meta.query[clStatName + '.aggregate'] = aggOps
      }

      // If request was for stats for a single doc and we have
      // a single result unpack the array into an opbject
      if (statOps.docId && results.length === 1) results = results[0]

      // done
      cb(null, results, _.pick(meta, ['more', 'query']))
    }
  }
}

exports.get = get
