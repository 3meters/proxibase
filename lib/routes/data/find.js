/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *      public web endpoints over safeFind and safeFindOne
 */


// Get /data/collection/:id?
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


// First
find.first = function(req, res) {
  req.collection.safeFirst(req.selector, req.dbOps, function(err, doc, meta) {
    send(err, doc, meta, res)
  })
}


// Last
find.last = function(req, res) {
  req.collection.safeLast(req.selector, req.dbOps, function(err, doc, meta) {
    send(err, doc, meta, res)
  })
}


// Next requires admin because it causes a write to the db.
find.next = function(req, res) {
  if (!(req.user && 'admin' === req.user.role)) return res.error(perr.badAuth())
  util.nextDoc(req.collectionName, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


// GenId
find.genId = function(req, res) {
  req.dbOps.genId = true
  // req.query is passed through because collections may
  // have their own genId functions that accept params
  req.collection.safeFind(req.query, req.dbOps, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


// Count
find.count = function(req, res) {
  delete req.selector._id
  req.dbOps.count = true
  req.collection.safeFind(req.selector, req.dbOps, function(err, count) {
    send(err, count, null, res)
  })
}


// CountBy
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


// Compose and send the response
function send(err, docs, meta, res) {

  var body

  // Whitelist meta properties to return
  meta = _.pick(meta || {}, [
    'user',
    'canEdit',
    'count',
    'sort',
    'limit',
    'skip',
    'more',
    'clientMinVersions',
    'time',
  ])

  // Whitelist user properties to return
  meta.user = _.pick(meta.user || {}, [
    '_id',
    'name',
  ])

  // Special-case count
  if (tipe.isNumber(docs)) body = {count: docs}
  else body = {data: docs}

  // Graft in meta
  body = _.extend(body, meta)

  // Send
  res.send(err, body)
}


// Exports
module.exports = find
