/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var util =  require('util')
  , db = util.db    // mongoskin connection
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , config = util.config
  , greeting = {}
  , find = exports.find = require('./find')
  , insert = exports.insert = require('./insert')
  , update = exports.update = require('./update')
  , remove = exports.remove = require('./remove')


// stash welcome info
exports.init = function(app) {
  greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  Object.keys(db.cNames).forEach(function(name) {
    greeting.data[name] = util.config.service.url + '/data/' + name
  })
  greeting.docs = config.service.docsUrl + '#rest'
}


// data router
exports.addRoutes = function (app) {
  app.get('/data/?', welcome)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
}


// get /data
function welcome(req, res) {
  res.send(greeting)
}


// Check and parse the request
//   returns an error or null on success
exports.scrub = function(req) {

  if (!req.c) { // request collection can be preset by the caller
    if (!db.cNames[req.params.collection]) return proxErr.notFound()
    req.cName = req.params.collection
    req.c = db.collection(req.cName)
  }
  req.model = gdb.models[req.cName]

  // Parse the ids if present
  if (req.params.id) req.query.ids = req.params.id.split(',')
  else {
    // convert ids to an array if passed in as query param
    if (req.query.ids && (typeof req.query.ids === 'string')) {
      req.query.ids = req.query.ids.split(',')
    }
  }

  // Parse the names if present
  if (req.query.names && (typeof req.query.names === 'string')) {
    req.query.names = req.query.names.split(',')
  }

  switch (req.method) {
    case 'get':
      delete req.body
      if (typeof req.query.find === 'string') {
        try { req.query.find = JSON.parse(req.query.find) }
        catch (e) { return new HttpErr(httpErr.badJSON, 'find') }
      }
      if (typeof req.query.fields === 'string') {
        req.query.fields = req.query.fields.split(',')
      }
      if (typeof req.query.name === 'string') {
        req.query.name = req.query.name.split(',')
      }
      break

    case 'delete':
      delete req.body
      if (!req.user) return new HttpErr(httpErr.badAuth)
      break

    case 'post':
      if (!req.user) return new HttpErr(httpErr.badAuth)
      if (!(req.body && req.body.data)) {
        return new HttpErr(httpErr.missingParam, 'data')
      }
      if (req.body.data instanceof Array) {
        if (req.body.data.length > 1) {
          return new HttpErr(httpErr.badValue, 'data: only one at a time')
        }
        else req.body.data = req.body.data[0]
      }
      // Our own schema check  TODO: move to validator
      for (key in req.body.data) {
        if (!req.model.schema.paths[key]) {
          return new HttpErr(httpErr.badParam, key)
        }
      }
      break

    default:
      return new HttpErr(httpErr.badParam, req.method)
  }
  return null  // success
}
