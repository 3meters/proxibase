/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web method over mongo.safeFind
 */


// get /data/collection/:id?
function find(req, res) {

  req.findOps.user = req.user

  if (req.findOne) {
    req.collection.safeFindOne(req.selector, req.findOps, function(err, result) {
      res.send(err, {data: result, count: (result) ? 1 : 0})
    })
  }
  else {
    req.findOps.sort = req.query.sort || [{modifiedDate: -1}]
    req.collection.safeFind(req.selector, req.findOps, function(err, result) {
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
  req.query.genId = true
  req.collection.safeFind(req.query, function(err, result) {
    res.send(err, result)
  })
}

find.count = function(req, res) {
  delete req.selector._id
  req.collection.safeFind(req.selector, {count: true}, function(err, result) {
    res.send(err, result)
  })
}

find.countBy = function(req, res) {
  var countBy = []
  if (tipe.isString(req.params.countBy)) {
    countBy = req.params.countBy.split(',')
  }
  delete req.selector._id
  req.collection.safeFind(req.selector, {countBy: countBy}, function(err, result) {
    res.send(err, result)
  })
}

module.exports = find
