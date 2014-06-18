/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web method over mongo.safeFind
 */


// get /data/collection/:id?
function find(req, res) {
  if (req.findOne) {
    req.collection.safeFindOne(req.selector, req.dbOps, function(err, docs, meta) {
      send(err, docs, meta, res)
    })
  }
  else {
    req.dbOps.sort = req.dbOps.sort || [{_id: -1}]
    req.collection.safeFind(req.selector, req.dbOps, function(err, docs, meta) {
       send(err, docs, meta, res)
    })
  }
}


find.next = function(req, res) {
  if (!(req.user && 'admin' === req.user.role)) return res.error(perr.badAuth())
  util.nextDoc(req.collectionName, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


find.genId = function(req, res) {
  req.dbOps.genId = true
  // req.query is passed through because collections may
  // have their own genId functions that accept params
  req.collection.safeFind(req.query, req.dbOps, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


find.count = function(req, res) {
  delete req.selector._id
  req.dbOps.count = true
  req.collection.safeFind(req.selector, req.dbOps, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}

find.countBy = function(req, res) {
  var countBy = []
  if (tipe.isString(req.params.countBy)) {
    countBy = req.params.countBy.split(',')
  }
  delete req.selector._id
  req.dbOps.countBy = countBy
  req.collection.safeFind(req.selector, req.dbOps, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


function send(err, docs, meta, res) {
  var body
  // special-case count
  if (tipe.isObject(docs) && tipe.isDefined(docs.count)
      && Object.keys(docs).length === 1) {
    body = docs
  }
  else {
    body = {data: docs}
    if (tipe.isObject(meta)) body = _.extend(body, meta)
  }
  res.send(err, body)
}

module.exports = find
