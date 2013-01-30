/**
 * app.js
 *
 *   Express app definition and top-level router
 */

var util = require('util')
var log = util.log
var url = require('url')
var fs = require('fs')
var path = require('path')
var assert = require('assert')
var express = require('express')
var app = express()
var middleware = require('./express/middleware')
var auth = require('./routes/auth')
var validateClientVersion = require('./routes/client').validate

require('./express/extendExpress')

// Express calls once before listen
app.configure(function() {
  app.use(express.static(path.join(__dirname, '../assets')))
  app.use(middleware.tagger())
  app.use(express.bodyParser())
  app.use(middleware.logger())
  app.use(app.router)
  app.use(middleware.errorHandler())
  addPreRoutes(app)
  addRoutes(app)
  addPostRoutes(app)
})


// All request pass through these routes first, in order
function addPreRoutes(app) {

  // Parse pathname and query string
  app.all('*', function(req, res, next) {
    debugger // breakpoint for each request
    req.method = req.method.toLowerCase()
    var urlObj = url.parse(req.url, true)
    var paths = urlObj.pathname.split('/')
    paths.shift() // remove leading empty element
    if (paths[paths.length - 1] === '') paths.pop() // url had trailing slash
    req.paths = paths
    req.urlQry = urlObj.query
    next()
  })

  // If a post contains base params hoist them to req.query
  app.post('*', function(req, res, next) {
    if (req.body) {
      if (req.body.lang && !req.query.lang) req.query.lang = req.body.lang
      if (req.body.user && !req.query.user) req.query.user = req.body.user
      if (req.body.session && !req.query.session) req.query.session = req.body.session
      if (req.body.version && !req.query.version) req.query.version = req.body.version
    }
    next()
  })

  // Set the default language per Royal British Navy AD 1600-1900
  app.all('*', function(req, res, next) {
    req.lang = req.query.lang || 'en'
    next()
  })

  // If request contains user and session token validate them
  app.all('*', function(req, res, next) {
    if (req.query.user && req.query.session) {
      return auth.validateSession(req, res, next)
    }
    next()
  })

  // If the request contains a client version check it
  app.all('*', function(req, res, next) {
    if (req.query.version) return validateClientVersion(req, res, next)
    next()
  })

  // Check all posts for valid content-type header
  app.post('*', function(req, res, next) {
    if (!req.headers['content-type']) {
      return res.error(proxErr.badRequest('Missing header content-type'))
    }
    var contentType = req.headers['content-type'].toLowerCase()
    if (contentType.indexOf('application/json') != 0) {
      return res.error(proxErr.badRequest('Invalid content-type: ' + contentType +
        ' Expected: application/json'))
    }
    next()
  })
}


// Load routes from the routes directory.  Route order is not garanteed,
// so cross-route dependencies should be made explicity
function addRoutes(app) {
  app.modules = {}
  var routeDir = path.join(__dirname, 'routes')
  fs.readdirSync(routeDir).forEach(function(modName) {
    if (/\.js$/.test(modName)) modName = modName.slice(0, (modName.length - 3))  // trim .js
    var mod = require(path.join(routeDir, modName))
    if (mod.init) mod.init(app)
    if (mod.addRoutes) mod.addRoutes(app)
  })
}


function addPostRoutes(app) {
  // Nobody answered, fall through
  app.all('*', function(req, res, next) {
    return res.error(proxErr.notFound())
  })
}

// Export app
module.exports = app
