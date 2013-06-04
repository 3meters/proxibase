/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web method over mongo.safeFind
 */

var data = require('./')

// get /data/collection/id?
module.exports = function(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.ids) {
    if ('genId' === req.query.ids[0]) {
      // Caller asked for magic method to pregenerate an id
      // TODO: need a better route for this
      return res.send({data: {_id: util.genId(req.collection.schema.id)}})
    }
  }

  req.collection.safeFind(req.query, function(err, results) {
    if (err) return res.error(err)
    return res.send(results)
  })
}
