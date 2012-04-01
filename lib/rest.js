
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

var
  db = require('./main').db   // mongoskin connection
  gdb = require('./main').gdb,  // mongooose connection
  utl =  require('./util'),
  log = utl.log

exports.get = function(req, res, cb) {
  cb = cb || function(data, code) {
    res.send(data, code)
  }
  var
    limit = 1000,
    selector = req.qry.find || {},
    options = {},
    searchNames = [],
    allFields = [],
    baseFields = [],
    moreRecords = []

  if (req.qry.ids) selector._id = {$in: req.qry.ids}
  if (req.qry.names) {
    // convert search terms to lowercase and search the namelc field
    req.qry.names.forEach(function(name) {
      searchNames.push(decodeURIComponent(name).toLowerCase())
    })
    selector.namelc = {$in: searchNames}
  }
  if (req.qry.fields) {
    allFields = req.qry.fields
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
    if (baseFields.length) options.fields = baseFields
  }

  if (req.qry.limit) {
    limit = Math.min(limit, parseInt(req.qry.limit))
  }
  options.limit = limit + 1 // cheap trick

  db.collection(req.modelName)
    .find(selector, options)
    .toArray(function process(err, docs) {
      if (err) return res.sendErr(err)
      checkMore(docs, limit)
      return res.send({
        data: docs,
        count: docs.length,
        more: moreRecords,
        time: utl.getElapsedTime(req.start)
      })
    })

  function checkMore(docs, limit) {
    if (docs.length > limit) {
      docs.pop()
      moreRecords.push(req.modelName)
    }
  }
}


// GET /model or /model/:id1,id2
exports.get2= function(req, res, cb) {
  cb = cb || function(data, code) {
    res.send(data, code)
  }
  var limit = 1000
  var query = req.model.find().limit(limit + 1)

  if (req.qry.find) query.find(req.qry.find)
  if (req.qry.ids) query.where('_id').in(req.qry.ids)
  if (req.qry.names) {
    // case-insensitive search
    for (var i = req.qry.names.length; i--;) {
      req.qry.names[i] = req.qry.names[i].toLowerCase()
    }
    query.where('namelc').in(req.qry.names)
  }
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

  // Unexpected database server error
  stream.on('error', function(err) {
    return cb(err.stack||err, 500)
  })

  stream.on('data', function(doc) {
    var self = this
    var doc = doc.serialize()
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
    var qry = gdb.models[childTable].find(whereClause).limit(limit + 1)
    qry.run(function(err, docs) {
      if (err) return res.sendErr(err)
      if (docs.length > limit) {
        docs.pop()
        moreRecords = true
      }
      for (var i = docs.length; i--;) {
        // convert mongo documents into ordinary objects
        docs[i] = docs[i].serialize()
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
    var et = utl.getElapsedTime(req.startDate)
    return cb({ data: docs, count: docs.length, more: moreRecords, time: et })
  })

}


// POST /model
exports.create = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode)
  }

  var doc = new req.model(req.body.data)
  if (doc instanceof Array) doc = doc[0] // only one record at a time for now

  doc.save(function (err, savedDoc) {
    if (err) return res.sendErr(err)
    if (!savedDoc._id) {
      var err =  new Error('Insert failed for unknown reason. Call for help')
      utl.logErr('Server error: ' +  err.message)
      utl.logErr('Document:', doc)
      return res.sendErr(err, 500)
    }
    cb({
      info: 'added to ' + req.modelName,
      count: 1,
      data: { _id: savedDoc._id }, 
    })
  })
}


// POST /model/:id
exports.update = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode)
  }

  if (req.qry.ids.length > 1)
    return res.sendErr(new Error('Updating multiple documents per request is not supported'))
  var docId = req.qry.ids[0]
  var newDoc = req.body.data
  if (newDoc._id && newDoc._id !== docId)
    return res.sendErr(new Error('Cannot change the value of _id'))

  var query = req.model.findOne({ _id: docId }, function (err, doc) {
    if (err) return res.sendErr(err)
    if (!doc) return res.sendErr(404)
    for (prop in newDoc) {
      doc[prop] = newDoc[prop]
    }
    doc.save(function(err, updatedDoc) {
      if (err) return res.sendErr(err)
      if (!updatedDoc) {
        var err = new Error('Update failed for unknown reason for doc ' + docId + ' Call for help')
        log('Error ' + err.message)
        return res.sendErr(err, 500)
      }
      cb({
        info: 'updated ' + req.modelName,
        count: 1,
        data: updatedDoc
      })
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
    if (err) return res.sendErr(err)
    cb({ info: 'deleted from ' + req.modelName, count: count })
  })
}


