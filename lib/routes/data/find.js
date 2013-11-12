/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web method over mongo.safeFind
 */

var data = require('./')

// get /data/collection/:id?
module.exports = function(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.id) {
    if ('genId' === req.query.id) {
      // Caller asked for magic method to pregenerate an id
      // Deprecated: use ?genId=1 instead
      return res.send({data: {_id: util.genId(req.collection.schema.id)}})
    }
    req.collection.safeFindOne(req.query, function(err, result) {
      if (err) return res.error(err)
      res.send({data: result})
    })
  }
  else {
    req.query.sort = req.query.sort || [{modifiedDate: -1}]
    req.collection.safeFind(req.query, function(err, result) {
      if (err) return res.error(err)
      res.send(result)
    })
  }
}
