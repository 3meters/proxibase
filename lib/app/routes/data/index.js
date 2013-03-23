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
    if (!db.schemas[req.params.collection]) return perr.notFound()
    req.cName = req.params.collection
    req.collection = db.collection(req.cName)
  }

  if (!req.cName) req.cName = req.collection.collectionName
  if (!req.cName) return perr.notFound()

  // Only allow admins to access system collections
  if (db.schemas[req.cName] && db.schemas[req.cName].system) {
    if (!(req.user && req.user.role === 'admin')) {
      return perr.badAuth()
    }
  }

  // Add id from /data/collection/id to query
  if (req.params.id) req.query.ids = req.params.id.split(',')

  switch (req.method) {
    case 'get':
      if (type.isString(req.query.find)) {
        try { req.query.find = JSON.parse(req.query.find) }
        catch (e) { return perr.badJSON('find') }
      }
      if (type.isString(req.query.fields)) {
        req.query.fields = req.query.fields.split(',')
      }
      if (type.isString(req.query.countBy)) {
        req.query.countBy = req.query.countBy.split(',')
      }
      if (type.isString(req.query.limit)) {
        req.query.limit = parseInt(req.query.limit)
      }
      if (type.isString(req.query.skip)) {
        req.query.skip = parseInt(req.query.skip)
      }
      break

    case 'delete':
      delete req.body
      if (!req.user) return perr.badAuth()
      break

    case 'post':
      if (!req.user) return perr.badAuth()
      if (!(req.body && req.body.data)) {
        return perr.missingParam('data')
      }
      if (req.body.data instanceof Array) {
        if (req.body.data.length > 1) {
          return perr.badValue('data: only one at a time')
        }
        else req.body.data = req.body.data[0]
      }
      if (req.body.skipValidation && 'admin' !== req.user.role) {
        return perr.badAuth()
      }
      break

    default:
      return perr.badParam(req.method)
  }
  return null  // success
}
