/**
 * /routes/stats
 *
 *    Get link counts from the calculated tos and froms link count collections.
 *
 *    These collections are stored in mongodb map-reduce format so that they can
 *    be incrementally reduced as new links are added.
 *
 *    See: http://docs.mongodb.org/manual/tutorial/perform-incremental-map-reduce
 *
 *    While efficient to maintain, that persistance format can be confusing to query.
 *
 *    This function accepts queries to the mongodb aggregation framework for an
 *    ordinary collection, and maps those queries to the underlying tos and froms
 *    mapReduce collections.
 */

exports.addRoutes = function(app) {
  app.post('/links/to', to)
  app.get('/links/to', to)
  app.post('/links/from', from)
  app.get('/links/from', from)
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


function run(req, cb) {

  var ops = [], clName = req.collection.collectionName

  // scrub
  var err = scrub(req.body, {
    query: {type: 'object', required: true},
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
  var sort = req.body.sort || {value: -1}
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


exports.to = to
exports.from = from
