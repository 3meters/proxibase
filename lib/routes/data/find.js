/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web method over mongo.safeFind
 */

var data = require('./')

// get /data/collection/:id?
function find(req, res) {

  var err = data.scrubReq(req)
  if (err) return res.error(err)

  if (req.query.id) {
    req.collection.safeFindOne(req.query, function(err, result) {
      res.send(err, {data: result, count: (result) ? 1 : 0})
    })
  }
  else {
    req.query.sort = req.query.sort || [{modifiedDate: -1}]
    req.collection.safeFind(req.query, function(err, result) {
      res.send(err, result)
    })
  }
}

find.next = function(req, res) {
  util.nextDoc(req.collectionName, function(err, result) {
    res.send(err, {data: result, count: (result) ? 1 : 0})
  })
}

find.genId = function(req, res) {
  req.collection.safeFind({genId: true}, function(err, result) {
    res.send(err, result)
  })
}

find.count = function(req, res) {
  req.collection.safeFind({count: true}, function(err, result) {
    res.send(err, result)
  })
}

find.countBy = function(req, res) {
  var err = data.scrubReq(req)
  if (err) return res.error(err)

  req.collection.safeFind({countBy: req.params.fieldNames}, function(err, result) {
    res.send(err, result)
  })
}

module.exports = find
