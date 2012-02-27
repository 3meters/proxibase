
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Local modules
var mdb = require('./main').mdb  // mongodb connection object
var log = require('./util').log
var sendErr = require('./util').sendErr

var notFound = { info: "Not found" }

// GET /model or /model/:id1,id2
exports.get = function(req, res, cb) {

  cb = cb || function(data, code) {
    res.send(data, code)
  }

  var limit = 1000
  var query = req.model.find().limit(limit + 1)

  if (req.qry.find)
    query.find(req.qry.find)

  if (req.qry.ids)
    query.where('_id').in(req.qry.ids)

  if (req.qry.names)
    query.where('name').in(req.qry.names)

  if (req.qry.fields) {
    var allFields = req.qry.fields
    var baseFields = []
    for (var i = allFields.length; i--;) {
      var dotAt = allFields[i].indexOf('.')
      if (dotAt < 0) { 
        // non-qualified field name, apply to base table
        baseFields.push(allFields[i])
      } else {
        childTableName = allFields[i].substr(0, dotAt)
        // TODO: add child table field names
      }
    }
    if (baseFields.length) query.fields(baseFields)
  }

  if (req.qry.lookups) {
    for (var path in req.model.schema.refParents) {
      query.populate(path, null)
    }
  }

  if (req.qry.limit) {
    limit = Math.min(limit, parseInt(req.qry.limit))
    query.limit(limit + 1)
  }

  var docs = []
  var moreRecords = false // set to true if the query or one of its subquerys hit its query limit
  var stream = query.stream()

  stream.on('error', function(err) {
    return cb(err.stack||err, 500)
  })

  stream.on('data', function(doc) {
    var self = this
    var doc = req.model.serialize(doc)
    if (req.qry.children) {
      self.pause() // pause outer stream
      getDocChildren(doc, req.qry.children.length, function(docWithChildren) {
        docs.push(docWithChildren)
        self.resume() // resume outer stream
      })
    } else
      docs.push(doc)
  })

  // get all children of each document from each childTable
  function getDocChildren(doc, iChildTable, cb) {
    if (!iChildTable--) return cb(doc) // break recursion
    var table = req.modelName
    var childTable = req.qry.children[iChildTable]
    var field = req.model.schema.refChildren[childTable]
    var whereClause = {}
    whereClause[field] = doc._id
    var qry = mdb.models[childTable].find(whereClause).limit(limit + 1)
    // qry.fields(["_id", "name"])
    qry.run(function(err, docs) {
      if (err) return sendErr(res, err)
      if (docs.length > limit) {
        docs.pop()
        moreRecords = true
      }
      for (var i = docs.length; i--;) {
        // convert mongo documents into ordinary objects
        docs[i] = mdb.models[childTable].serialize(docs[i])
      }
      doc[childTable] = docs
      return getDocChildren(doc, iChildTable, cb) // recurse
    })
  }

  stream.on('close', function() {
    if (docs.length > limit) {
      docs.pop()
      moreRecords = true
    }
    return cb({ data: docs, count: docs.length, more: moreRecords })
  })

}


// POST /model
exports.create = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode)
  }

  var doc = new req.model(req.body.data[0]) // only one record at a time for now

  doc.save(function (err, savedDoc) {
    if (err) return sendErr(res, err)
    // embed in array for consistency with get
    cb({
      data: [ { _id: savedDoc._id } ], 
      info: "added to " + req.modelName,
      count: 1
    })
  })
}


// POST /model/:id
exports.update = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode)
  }

  if (req.qry.ids.length > 1)
    return cb({ Error: "Updating multiple documents per request is not supported" }, 400)
  if (req.body.data[0]._id && req.body.data[0]._id !== req.qry.ids[0])
    return cb({ Error: "Cannot change the value of _id" }, 400)

  var query = req.model.findOne({ _id: req.qry.ids[0] }, function (err, doc) {
    if (err) return sendErr(res, err)
    if (!doc) res.send(notFound, 404)
    for (prop in req.body.data[0]) {
      doc[prop] = req.body.data[0][prop]
    }
    doc.save(function(err, newDoc) {
      if (err) return sendErr(res, err)
      if (!newDoc) return sendErr(res, new Error("Update failed for unknown reason"), 500)
      return res.send({ data: [ newDoc ], info: "updated " + req.modelName, count: 1 })
    })
  })
}


// DELETE /model/:id1,id2,
exports.destroy = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode)
  }

  var query = req.model.remove()

  if (req.qry.ids[0] !== '*')
    query.where('_id').in(req.qry.ids)
  query.run(function(err, count, docs) {
    if (err) return sendErr(res, err)
    cb({ info: "deleted from " + req.modelName, count: count })
  })
}


