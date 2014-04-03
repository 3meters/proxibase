/**
 * routes/do/countLinks.js
 *    get link counts from the calculated tostats and from stats collections.
 *    Inputs are the same as ordinary rest find.
 *    Maps the default rest output to a format that the client likes.
 */


exports.to = function(req, res) {
  req.collection =  db.safeCollection('tostats')
  exports.run(req, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}

exports.from = function(req, res) {
  req.collection = db.safeCollection('fromstats')
  exports.run(req, function(err, results) {
    if (err) return res.error(err)
    res.send({data: results})
  })
}

exports.run = function run(req, cb) {

  var err = scrub(req.body, db.safeFindSpec())
  if (err) return cb(err)

  // Anon users can see aggregated link count data from owner-access collections
  req.dbOps.asAdmin = true

  var findOps = req.body
  var selector = findOps.query || {}
  delete findOps.query
  findOps.sort = findOps.sort || [{count: -1}]
  findOps.refs = findOps.refs || '_id,name,photo,schema,category'
  findOps = _.extend(findOps, req.dbOps)

  req.collection.safeFind(selector, findOps, function(err, rawData) {
    if (err) return cb(err)
    var rank = 1
    var data = rawData.data.map(function(raw) {
      var ent = raw.to || raw.from || {}
      return {
        _id: ent._id,
        name: ent.name,
        // type: raw.type,  // not in spec but in the data, probably needed
        photo: ent.photo,
        schema: ent.schema,
        category: ent.category,
        count: raw.count,
        rank: rank++,
      }
    })
    cb(null, data)
  })
}

exports.to.anonOk = true
exports.from.anonOk = true
