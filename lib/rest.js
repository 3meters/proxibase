
/*
 * Rest.js -- default resource manager
 *    Performs basic crud operations on mongo collections
 */

var
  assert = require('assert')
  db = require('./main').db   // mongoskin connection
  gdb = require('./main').gdb,  // mongooose connection
  util =  require('./util'),
  log = util.log


// Check Pemissions
exports.checkPermissions = function(req, res, next) {

  req.method = req.method.toLowerCase()

  switch (req.method) {

    case 'get':
      delete req.body
      return next()
      break

    case 'delete':
      delete req.body
      // don't break, fall through to post

    case 'post':
      if (!req.user) return res.error(httpErr.badAuth)
      if (req.body && req.body.data) {
        if (req.body.data instanceof Array) {
          if (req.body.data.length > 1) {
            return res.error(new HttpErr(httpErr.badValue, 'data: only one at a time'))
          }
          else {
            req.body.data = req.body.data[0]
          }
        }
        // Our own schema check
        for (key in req.body.data) {
          if (!req.model.schema.paths[key]) {
            return next (new HttpErr(httpErr.badParam, key))
          }
        }
      }
      return next()
      break

    default:
      return res.error(new HttpErr(httpErr.badParam, req.method))

  }
}


// GET/model
exports.get = function(req, res) {

  var
    limit = 1000,
    selector = req.qry.find || {},
    options = {},
    searchNames = [],
    allFields = [],
    baseFields = [],
    moreRecords = false

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
      if (err) return res.error(err)
      checkMore(docs, limit)
      var body = {
        data: docs,
        count: docs.length,
        more: moreRecords,
        time: req.timer.read()
      }
      res.send(body)
    })

  function checkMore(docs, limit) {
    if (docs.length > limit) {
      docs.pop()
      moreRecords = true
    }
  }
}


// OLD CODE FOR ARCHIVE GET /model or /model/:id1,id2
exports.get2= function(req, res) {

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
    res.error(err)
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
      if (err) return res.error(err)
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
    var body = { data: docs, count: docs.length, more: moreRecords, time: req.timer.read() }
    res.send(body)
  })

}


// POST /model
exports.create = function(req, res) {

  var doc = new req.model(req.body.data)
  if (doc instanceof Array) doc = doc[0] // only one record at a time for now

  doc.__user = req.user

  doc.save(function (err, savedDoc) {
    if (err) {
      if (err.name === 'MongoError' && err.code === 11000) {
        return res.error(new HttpErr(httpErr.noDupes, err.message))
      }
      else return res.error(err)
    }
    res.send({
      info: 'added to ' + req.modelName,
      count: 1,
      data: { _id: savedDoc._id }
    }, 201)
  })
}


// POST /model/:id
exports.update = function(req, res) {

  if (req.qry.ids.length > 1)
    return res.error(new Error('Updating multiple documents per request is not supported'))
  var docId = req.qry.ids[0]
  var newDoc = req.body.data
  if (newDoc._id && newDoc._id !== docId)
    return res.error(new Error('Cannot change the value of _id'))

  var query = req.model.findOne({ _id: docId }, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(404)
    for (prop in newDoc) {
      doc[prop] = newDoc[prop]
    }
    doc.__user = req.user // authenticate the save
    doc.save(function(err, updatedDoc) {
      if (err) {
        if (err.name === 'MongoError' && err.code === 11000) {
          return res.error(new HttpErr(httpErr.noDupes, err.message))
        }
        else return res.error(err)
      }
      if (!updatedDoc) return res.error(httpErr.serverError)
      res.send({
        info: 'updated ' + req.modelName,
        count: 1,
        data: updatedDoc
      })
    })
  })
}


// DELETE /model/ids:id1,id2,
exports.destroy = function(req, res) {

  assert(req.qry.ids || (req.body && req.body.ids && req.model))

  // Admins bypass record-at-a-time delete
  if (req.user.role && req.user.role === 'admin') {
    var query = req.model.remove()

    if (req.qry.ids) {
      if (req.qry.ids[0] !== '*') {
        query.where('_id').in(req.qry.ids)
      }
    }
    else {
      query.where('_id').in(req.body.ids)
    }

    query.run(function(err, count, docs) {
      if (err) return res.error(err)
      res.send({ info: 'deleted from ' + req.modelName, count: count })
    })
  } 
  else {
    req.model.where('_id').in(req.qry.ids).exec(function(err, docs) {
      if (err) return res.error(err)
      removeDoc(docs.length)

      function removeDoc(iDoc) {
        if (!iDoc--) {
          return res.send({
            info: 'deleted from ' + req.modelName,
            count: docs.length
          })
        }
        docs[iDoc].__user = req.user
        docs[iDoc].remove(function(err) {
          if (err) return res.error(err)
          return removeDoc(iDoc)
        })
      }
    })
  }
}


