/**
 * routes/data.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var assert = require('assert')
  , util =  require('util')
  , db = util.db    // mongoskin connection
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , cNameRE = new RegExp('(' + Object.keys(db.cNames).join('|') + ')(/|$)')
  , welcomeInfo


// data router
exports.service = function(app) {
  welcomeInfo = app.info.data
  app.get('/data/?', welcome)
  app.all('/data/:collection/:id?', check)
  app.all('/data/:collection/:id?', parse)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
}


// get /data
function welcome(req, res) {
  res.send({data: welcomeInfo})
}


// Ensure the collection is valid
function check(req, res, next) {
  if (!db.cNames[req.params.collection]) return res.error(httpErr.notFound)
  req.cName = req.params.collection
  req.model = gdb.models[req.params.collection]
  next()
}


// Parse request parameters
var parse = exports.parse = function(req, res, next) {

  // Parse the ids if present
  if (req.params.id) {
    // For backward compat
    if (req.params.id.indexOf('ids:') === 0) {
      req.params.id = req.params.id.slice(4)
    }
    req.query.ids = req.params.id.split(',')
  }

  // convert ids to an array if passed in as query param
  if (req.query.ids && (typeof req.query.ids === 'string')) {
    req.query.ids = req.query.ids.split(',')
  }

  switch (req.method) {
    case 'get':
      delete req.body
      if (req.query.find) {
        try { req.query.find = JSON.parse(req.query.find) }
        catch (e) { return res.error(new HttpErr(httpErr.badJSON, 'find')) }
      }
      if (req.query.fields) {
        req.query.fields = req.query.fields.split(',')
      }
      if (req.query.name) {
        req.query.name = req.query.name.split(',')
      }
      break

    case 'delete':
      delete req.body
      if (!req.user) return res.error(httpErr.badAuth)
      break

    case 'post':
      if (!req.user) return res.error(httpErr.badAuth)
      if (!(req.body && req.body.data)) {
        return res.error(new HttpErr(httpErr.missingParam, 'data'))
      }
      if (req.body.data instanceof Array) {
        if (req.body.data.length > 1) {
          return res.error(new HttpErr(httpErr.badValue, 'data: only one at a time'))
        }
        else req.body.data = req.body.data[0]
      }
      // Our own schema check  TODO: move to validator
      for (key in req.body.data) {
        if (!req.model.schema.paths[key]) {
          return res.error(new HttpErr(httpErr.badParam, key))
        }
      }
      break

    default:
      return res.error(new HttpErr(httpErr.badParam, req.method))
  }
  return next && next()  // callback is optional
}


// get /data/collection/id?
var find = exports.find = function (req, res, next) {

  var limit = 1000
    , options = {}
    , searchNames = []
    , allFields = []
    , baseFields = []
    , moreRecords = false
    , q = checkQuery(req.query)

  if (q instanceof Error) return res.error(q)
  var selector = q.find || {}

  if (req.query.ids) selector._id = {$in: req.query.ids}
  if (req.query.name) {
    // convert search terms to lowercase and search the namelc field
    req.query.name.forEach(function(name) {
      searchNames.push(decodeURIComponent(name).toLowerCase()) // TODO: how to decode spaces in get URLs?
    })
    selector.namelc = {$in: searchNames}
  }
  if (req.query.fields) {
    allFields = req.query.fields
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

  if (req.query.limit) {
    limit = Math.min(limit, parseInt(req.query.limit))
  }
  options.limit = limit + 1 // cheap trick

  if (req.query.sort) {
    options.sort = req.query.sort
  }

  if (req.query.skip) {
    options.skip = req.query.skip
  }

  // Count
  if (req.query.count) {
    return db.collection(req.cName)
      .find(selector, options)
      .count(function process(err, count) {
        if (err) return res.error(err)
        res.send({count:count})
      })
  }

  // CountBy
  if (req.query.countBy) return aggregateBy('countBy', req.query.countBy)

  // Regular find
  return db.collection(req.cName)
    .find(selector, options)
    .toArray(getLookups)

  // Check query
  function checkQuery(q) {
    return q
  }


  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(agg, groupOn) {
    // TODO: require admin credentials to run countBy queries?
    if (!req.model.schema.paths[groupOn]) {
      return res.error(new HttpErr(httpErr.badParam, [agg, groupOn, 'must be a key in the collection']))
    }
    switch(agg) {
      case 'countBy':
        var map = function() { emit(this[groupOn], 1) }
        var reduce = function(k, v) {
          var count = 0
          v.forEach(function(c) { count+= c })
          return count
        }
        break
      default:
        throw new Error('Invalid call to aggregateBy')
    }
    var options = {
      query: selector,
      scope: {groupOn: groupOn}, // local vars passed to mongodb
      out: {inline: 1}
    }
    db.collection(req.cName)
      .mapReduce(map, reduce, options, function(err, docs){
        if (err) return res.error(err)
        var results = []
        docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
        // mongo returns very generic looking results from map reduce operations
        // transform those results back into the terms of the original query
        docs.forEach(function(doc) {
          var result = {}
          result[groupOn] = doc._id
          result[agg] = doc.value
          results.push(result)
        })
        return getLookups(null, results)
      })
  }

  // Populate lookups
  function getLookups(err, docs) {
    if (err) return res.error(err)
    if (!req.query.lookups) return sendResults(err, docs)
    Object.keys(req.model.schema.refParents).forEachAsync(function(ref) {
      var idMap = {}
    }, sendResults(err, docs))
  }

  function sendResults(err, docs) {
    if (err) return res.error(err)
    checkMore(docs, limit)
    var body = {
      data: docs,
      count: docs.length,
      more: moreRecords,
    }
    return res.send(body)
  }

  function checkMore(docs, limit) {
    if (docs.length > limit) {
      docs.pop()
      moreRecords = true
    }
  }


}


// OLD CODE FOR ARCHIVE GET /model or /model/:id1,id2
var find2 = function(req, res)  {

  var limit = 1000
  var query = req.model.find().limit(limit + 1)

  if (req.query.find) query.find(req.query.find)
  if (req.query.ids) query.where('_id').in(req.query.ids)
  if (req.query.name) {
    // case-insensitive search
    for (var i = req.query.name.length; i--;) {
      req.query.name[i] = req.query.name[i].toLowerCase()
    }
    query.where('namelc').in(req.query.name)
  }
  if (req.query.fields) {
    var allFields = req.query.fields
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

  if (req.query.lookups) {
    for (var path in req.model.schema.refParents) {
      query.populate(path, null)
    }
  }

  if (req.query.limit) {
    limit = Math.min(limit, parseInt(req.query.limit))
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
    if (req.query.children) {
      self.pause() // pause outer stream
      getDocChildren(doc, req.query.children.length, function(docWithChildren) {
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
    var childTable = req.query.children[iChildTable]
    var field = req.model.schema.refChildren[childTable]
    var whereClause = {}
    whereClause[field] = doc._id
    var query = gdb.models[childTable].find(whereClause).limit(limit + 1)
    query.exec(function(err, docs) {
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
    res.send({data:docs, count:docs.length, more:moreRecords})
  })

}


// post /data/collection
var insert = exports.insert = function(req, res) {

  var doc = new req.model(req.body.data)

  doc.__user = req.user

  doc.save(function (err, savedDoc) {
    if (err) return util.handleDbErr(err, res)  //TODO: move out of util in res.error 
    res.send(201, {
      info: 'added to ' + req.cName,
      count: 1,
      data: savedDoc
    })
  })
}


// post /data/collection/id
var update = exports.update = function(req, res) {

  if (req.query.ids.length > 1)
    return res.error(400, 'Updating multiple documents per request is not supported')
  var docId = req.query.ids[0]
  var newDoc = req.body.data
  if (newDoc._id && newDoc._id !== docId)
    return res.error(400, 'Cannot change the value of _id')

  var query = req.model.findOne({ _id: docId }, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(404)
    for (prop in newDoc) {
      doc[prop] = newDoc[prop]
    }
    doc.__user = req.user // authenticate the save
    doc.save(function(err, updatedDoc) {
      if (err) return util.handleDbErr(err, res)
      res.send({
        info: 'updated ' + req.cName,
        count: 1,
        data: updatedDoc
      })
    })
  })
}


// delete /data/collection/id1,id2
var remove = exports.remove = function(req, res) {

  assert(req.query.ids || (req.body && req.body.ids && req.model))

  // Admins bypass record-at-a-time delete
  if (req.user.role && req.user.role === 'admin') {
    var query = req.model.remove()

    if (req.query.ids) {
      if (req.query.ids[0] !== '*') {
        query.where('_id').in(req.query.ids)
      }
    }
    else {
      query.where('_id').in(req.body.ids)
    }

    query.exec(function(err, count, docs) {
      if (err) return res.error(err)
      res.send({ info: 'deleted from ' + req.cName, count: count })
    })
  }
  else {
    req.model.where('_id').in(req.query.ids).exec(function(err, docs) {
      if (err) return res.error(err)
      if (docs.length === 0) return res.error(httpErr.notFound)
      removeDoc(docs.length)

      function removeDoc(iDoc) {
        if (!iDoc--) {
          return res.send({
            info: 'deleted from ' + req.cName,
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
