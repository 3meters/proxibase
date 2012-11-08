/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var util =  require('util')
  , db = util.db    // mongoskin connection
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
  for (var name in db.schemas) {
    greeting.data[name] = util.config.service.url + '/data/' + name
  }
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

  if (!req.collection) { // may be preset by the caller
    if (!db.schemas[req.params.collection]) return proxErr.notFound()
    req.cName = req.params.collection
    req.collection = db.collection(req.cName)
  }

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
        catch (e) { return proxErr.badJSON('find') }
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
      if (!req.user) return proxErr.badAuth()
      break

    case 'post':
      if (!req.user) return proxErr.badAuth()
      if (!(req.body && req.body.data)) {
        return proxErr.missingParam('data')
      }
      if (req.body.data instanceof Array) {
        if (req.body.data.length > 1) {
          return proxErr.badValue('data: only one at a time')
        }
        else req.body.data = req.body.data[0]
      }
      break

    default:
      return proxErr.badParam(req.method)
  }
  return null  // success
}
