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
  app.post('/stats/to', to)
  app.get('/stats/to', to)
  app.post('/stats/from', from)
  app.get('/stats/from', from)
  app.get('/stats/to/refresh', refreshTo)
  app.get('/stats/to/rebuild', rebuildTo)
  app.get('/stats/from/refresh', refreshFrom)
  app.get('/stats/from/rebuild', rebuildFrom)
  app.get('/stats/refresh', refresh)
  app.get('/stats/rebuild', rebuild)
}


function to(req, res) {
  req.collection =  db.safeCollection('tos')
  run(req, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function from(req, res) {
  req.collection = db.safeCollection('froms')
  run(req, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function refreshTo(req, res) {
  db.tos.refresh(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function refreshFrom(req, res) {
  db.froms.refresh(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function rebuildTo(req, res) {
  db.tos.rebuild(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function rebuildFrom(req, res) {
  db.froms.rebuild(req.dbOps, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}


function refresh(req, res) {
  db.tos.refresh(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.refresh(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({data: {to: toResults, from: fromResults}})
    })
  })
}


function rebuild(req, res) {
  db.tos.rebuild(req.dbOps, function(err, toResults) {
    if (err) return res.error(err)
    db.froms.rebuild(req.dbOps, function(err, fromResults) {
      if (err) return res.error(err)
      res.send({data: {to: toResults, from: fromResults}})
    })
  })
}


// Get the stats
function run(req, cb) {

  var ops = [], clName = req.collection.collectionName

  // scrub
  var err = scrub(req.body, {
    query: {type: 'object', default: {}},
    sort:  {type: 'object|array'},
    limit: {type: 'number', default: statics.db.limits.default},
    skip:  {type: 'number', default: 0}
  })
  if (err) return cb(err)

  // $match
  ops.push({$match: req.body.query})

  // $group
  var group = {
    _id: (clName === 'tos') ? '$_id._to' : '$_id._from',
    value: {$sum: '$value'},
  }
  if ('tos' === clName) group.toSchema = {$first: '$_id.toSchema'}
  else group.fromSchema = {$first: '$_id.fromSchema'}
  ops.push({$group: group})

  // $sort, $limit, $skip
  var sort = req.body.sort || {value: -1, '_id.day': -1}
  ops.push({$sort: sort})
  ops.push({$limit: req.body.limit})
  ops.push({$skip: req.body.skip})

  // map the id back
  var project = {
    count: '$value',
  }
  if ('tos' === clName) {
    project._to = '$_id'
    project.toSchema = '$toSchema'
  }
  else {
    project._from = '$_id'
    project.fromSchema = '$fromSchema'
  }
  ops.push({$project: project})

  // agregate
  req.collection.aggregate(ops, function(err, aggResults) {
    if (err) return cb(err)

    // get referenced data from base documents
    var refOps = {
      asAdmin: true,
      refs: 'name,photo,category',
    }

    req.collection.getRefs(aggResults, refOps, function(err, raggedDocs) {
      if (err) return cb(err)
      var rank = 1
      var docs = raggedDocs.map(function(ragged) {
        var ent = ragged.to || ragged.from || {}
        return {
          _id: ragged._id,
          name: ent.name,
          photo: ent.photo,
          schema: ragged.toSchema || ragged.fromSchema,
          category: ent.category,
          count: ragged.count,
          rank: rank++,
        }
      })
      cb(null, docs)
    })
  })
}


// To support calling from the deprecated api /do/countLinks
exports.to = to
exports.from = from
