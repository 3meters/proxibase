/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var db = util.db
var config = util.config
var type = util.type
var find = exports.find = require('./find')
var insert = exports.insert = require('./insert')
var update = exports.update = require('./update')
var remove = exports.remove = require('./remove')


// Data router
exports.addRoutes = function (app) {
  app.get('/data/?', welcome)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  for (var name in db.schemas) {
    greeting.data[name] = config.service.url + '/data/' + name
  }
  greeting.docs = config.service.docsUrl + '#rest'
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

  if (!req.cName) req.cName = req.collection.collectionName
  if (!req.cName) return proxErr.notFound()

  // Only allow admins to access system collections
  if (db.schemas[req.cName] && db.schemas[req.cName].system) {
    if (!(req.user && req.user.role === 'admin')) {
      return proxErr.badAuth()
    }
  }

  // Parse the ids if present
  if (req.params.id) req.query.ids = req.params.id.split(',')
  else {
    // convert ids to an array if passed in as query param
    if (req.query.ids && type.isString(req.query.ids)) {
      req.query.ids = req.query.ids.split(',')
    }
  }

  // Parse the names if present
  if (req.query.names && type.isString(req.query.names)) {
    req.query.names = req.query.names.split(',')
  }

  switch (req.method) {
    case 'get':
      delete req.body
      if (type.isString(req.query.find)) {
        try { req.query.find = JSON.parse(req.query.find) }
        catch (e) { return proxErr.badJSON('find') }
      }
      if (type.isString(req.query.fields)) {
        req.query.fields = req.query.fields.split(',')
      }
      if (type.isString(req.query.countBy)) {
        req.query.countBy = req.query.countBy.split(',')
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
      if (req.body.skipValidation && 'admin' !== req.user.role) {
        return proxErr.badAuth()
      }
      break

    default:
      return proxErr.badParam(req.method)
  }
  return null  // success
}