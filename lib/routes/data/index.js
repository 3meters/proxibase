/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var db = util.db
var config = util.config
var tipe = util.tipe
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
  app.get('/find/:collection/:id?', find)
  app.post('/find/:collection/:id?', function(req, res) {
    // Same as a get but accepts body params for complicated queries
    _.extend(req.query, req.body)
    req.method = 'get'
    find(req, res)
  })
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  for (var name in db.schemas) {
    greeting.data[name] = config.service.url + '/data/' + name
  }
  greeting.findQuerySpec = db.users.safeFind.schema()
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

  if (!req.collection) return perr.notFound()

  // Only allow admins to access system collections
  if (db.schemas[req.cName] && db.schemas[req.cName].system) {
    if (!(req.user && req.user.role === 'admin')) {
      return perr.badAuth()
    }
  }

  // Add id from /data/collection/id to query
  if (req.params.id) {
    if (/\,/.test(req.params.id)) {
      req.query.ids = req.params.id.split(',')
    }
    else {
      req.query.id = req.params.id
    }
  }

  // Convert query string params into arrays or objects
  if (req.query) {
    if (tipe.isString(req.query.find)) {
      try { req.query.find = JSON.parse(req.query.find) }
      catch (e) { return perr.badJSON('find') }
    }
    if (tipe.isString(req.query.fields)) {
      req.query.fields = req.query.fields.split(',')
    }
    if (tipe.isString(req.query.countBy)) {
      req.query.countBy = req.query.countBy.split(',')
    }
  }

  switch (req.method) {
    case 'get':
      // Require req.user here to require auth for reads
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
      if (tipe.isArray(req.body.data)) {
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
