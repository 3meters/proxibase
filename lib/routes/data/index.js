/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var db = util.db
var config = util.config
var tipe = util.tipe
var find = require('./find')
var insert = require('./insert')
var update = require('./update')
var remove = require('./remove')


// Data router
exports.addRoutes = function (app) {
  app.get('/data/?', welcome)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
  app.get('/find/:collection/:id?', find)
  app.post('/find/:collection/:id?', function(req, res) {
    // Same as get but accepts params in post body
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
  for (var clName in statics.collections) {
    greeting.data[clName] = config.service.url + '/data/' + clName
  }
  greeting.docs = config.service.docsUrl + '#rest'
  greeting.getParams = db.users.safeFind.schema()
  res.send(greeting)
}



// Check and parse the request
//   returns an error or null on success
exports.scrub = function(req) {


  var clStatic = statics.collections[req.params.collection]
  if (!clStatic) return perr.notFound()

  req.schema = db.safeSchemas[clStatic.schema]
  req.collectionName = clStatic.name
  req.collection = db.collection(req.collectionName)

  if (!req.collection) return perr.notFound()

  // Only allow admins to access system collections
  if (req.schema.system) {
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

exports.find = find
exports.insert = insert
exports.update = update
exports.remove = remove
