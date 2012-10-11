/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var assert = require('assert')
  , util =  require('util')
  , db = util.db    // mongoskin connection
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , find = require('./find')
  , cNameRE = new RegExp('(' + Object.keys(db.cNames).join('|') + ')(/|$)')
  , greeting


// data router
exports.service = function (app) {
  greeting = app.info.data
  app.get('/data/?', welcome)
  app.all('/data/:collection/:id?', check)
  app.all('/data/:collection/:id?', parse)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
}

exports.find = find

// get /data
function welcome(req, res) {
  res.send({data: greeting})
}


// Ensure the collection is valid
function check(req, res, next) {
  if (!db.cNames[req.params.collection]) return res.error(httpErr.notFound)
  req.cName = req.params.collection
  req.c = db.collection(req.cName)
  req.model = gdb.models[req.params.collection]
  next()
}


// Parse request parameters
var parse = exports.parse = function (req, res, next) {

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


// post /data/collection
function insert(req, res) {

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
function update(req, res) {

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
function remove(req, res) {

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
