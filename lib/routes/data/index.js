/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var util =  require('util')
  , db = util.db    // mongoskin connection
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , greeting
  , find = exports.find = require('./find')
  , insert = exports.insert = require('./insert')
  , update = exports.update = require('./update')
  , remove = exports.remove = require('./remove')


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

