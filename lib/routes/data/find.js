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

  if (req.query.nextId) {
    return util.nextId(req.collectionName, function(err, nextId) {
      if (err) return res.error(err)
      return res.send({nextId: nextId})
    })
  }
  if (req.query.id) {
    req.collection.safeFindOne(req.query, function(err, result) {
      if (err) return res.error(err)
      res.send({data: result, count: (result) ? 1 : 0})
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
