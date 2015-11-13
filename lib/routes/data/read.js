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
    // Jay wants a way to pass through promoting linked documents
    // to top-level results. There is probably a more general way to do this.
    req.collection.safeFindOne(req.selector, req.dbOps, function(err, docs, meta) {
      if (req.selector.promote) meta.promote = req.selector.promote
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


// Find a doc by id by parsing the collection name from its id
find.byId = function(req, res) {
  if (/\,/.test(req.params.id)) {
    return find.findByIds(req, res)
  }
  db.safeFindById(req.params.id, req.dbOps, function(err, doc, meta) {
    send(err, doc, meta, res)
  })
}


// Find by ids parsing the collection names from the ids
find.findByIds = function(req, res) {
  var ids = req.params.id.split(',')
  db.safeFindByIds(ids, req.dbOps, function(err, docs, meta) {
    send(err, docs, meta, res)
  })
}


// Compose and send the response
function send(err, docs, meta, res) {

  if (err) return res.error(err)

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
    'promote',
    'clientMinVersions',
    'time',
    'dbTime',
  ])

  // Whitelist user properties to return
  meta.user = _.pick(meta.user || {}, [
    '_id',
    'name',
  ])

  //
  // This is an expediant hack for the convenience of the iPhone client.
  // Optionally return the value of an object's property as the top-level
  // result. This is a poor-mans map or project to support the iPhone client
  // that wants find patches.myPatch linked messages to return a
  // top-level array of messages, rather than a top level document
  // of a patch with a nested array of messages under the linked
  // property. For this type of transform 20 lines on the server
  // would require 200 lines on the client, so hack we do.
  //
  if (meta.promote) {
    if (!docs) {
      meta.parentCount = 0
      docs = []
    }
    else {
      var doc = docs  // Promote only works for safeFindOne
      meta.parentCount = 1
      if (meta.promote === 'links') {
        if (doc.moreLinks) meta.more = doc.moreLinks
      }
      if (meta.promote === 'linked') {
        if (doc.moreLinked) meta.more = doc.moreLinked
      }
      var promoted = doc[meta.promote]
      delete doc[meta.promote]
      meta.parentEntity = doc
      docs = promoted
    }
    meta.count = docs.length
  }

  // Special-case count
  if (tipe.isNumber(docs)) body = {count: docs}
  else body = {data: docs}

  // Graft in meta
  body = _.extend(body, meta)

  // Send
  res.send(body)
}


// Exports
module.exports = find
