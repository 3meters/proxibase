/**
 * app: Express app config and top-level router
 */

var url = require('url')
var path = require('path')
var express = require('express')
var favicon = require('serve-favicon')
var robots = require('robots.txt')
var compression = require('compression')
var serveStatic = require('serve-static')
var bodyParser = require('body-parser')
var app = express()
var middleware = require('./middleware')
var routeDir = path.join(__dirname, '../routes')
var auth = require(path.join(routeDir, 'auth'))
var validateClientVersion = require(path.join(routeDir, 'client')).validate
var updateInstall = require(path.join(routeDir, 'do/methods')).updateInstall

require('./express')  // Extend Express


// Init on module load
init()


// Set up the app middleware and routes
function init() {

  app.use(favicon(path.join(__dirname, '../../assets/favicon.ico')))
  app.use(robots(path.join(__dirname, '../../assets/robots.txt')))

  app.use('/v1/assets/', serveStatic(path.join(__dirname, '../../assets')))

  app.use(middleware.tagger())
  app.use(compression())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))
  // Our custom middleware
  app.use(middleware.logger())
  app.use(middleware.requestLogger())
  app.use(middleware.apiVersioner())
  addPreRoutes(app)
  addRoutes(app)
  addPostRoutes(app)
  app.use(middleware.errorHandler())
}


// All requests pass through these routes first, in order
function addPreRoutes(app) {

  // Parse pathname and query string
  app.all('*', function(req, res, next) {
    req.method = req.method.toLowerCase()
    var urlObj = url.parse(req.url, true)
    var paths = urlObj.pathname.split('/')
    paths.shift() // remove leading empty element
    if (paths[paths.length - 1] === '') paths.pop() // url had trailing slash
    req.paths = paths
    // accept body params on the query string
    if (_.isEmpty(req.body) && tipe.isObject(req.query) && !_.isEmpty(req.query)) {
      req.body = req.query
    }
    next()
  })


  // If a post contains base params hoist them to req.query
  app.post('*', processBody)
  app.put('*', processBody)

  function processBody(req, res, next) {
    if (req.body) {
      var paramWhiteList = [
        'lang',
        'user',
        'session',
        'version',
        'install',
        'installId',
        'location',
        'll',
        'beacons',
        'log',
      ]
      paramWhiteList.forEach(function(param) {
        if (req.body[param] && !req.query[param]) req.query[param] = req.body[param]
      })
    }
    next()
  }


  // Set the default language per Royal British Navy AD 1600-1900
  app.all('*', function(req, res, next) {
    req.lang = req.query.lang || 'en'
    next()
  })


  // If request contains user and session tokens validate them
  app.all('*', function(req, res, next) {
    if (req.query.user && req.query.session) {
      return auth.validateSession(req, res, next)
    }
    next()
  })


  // Check user roles
  app.all('*', function(req, res, next) {
    if (!req.user) return next()
    switch (req.user.role) {
      case 'user':
      case 'admin':
        return next()
        break
      case 'reset':
        if ('user/resetpw' === (req.paths[0] + '/' + req.paths[1])) {
          return next()
        }
        else return next(perr.badAuth())
        break
      default:
        return next(perr.serverError('Unexpected user role', req.user))
    }
  })


  // Set the default database options
  app.all('*', function(req, res, next) {
    req.dbOps = {ip: req.ip, tag: req.tag}
    if (req.user) req.dbOps.user = req.user
    next()
  })


  // Convert the shorthand ll param to a location object
  app.all('*', function(req, res, next) {
    if (req.query.ll && !req.query.location) {
      req.query.location = util.latLngToLocation(req.query.ll)
      if (req.body && !req.body.location) req.body.location = req.query.location
    }
    next()
  })


  // Update the install's location and / or beacons if provided
  app.all('*', function(req, res, next) {

    // Accept either install or installId
    req.query.install = req.query.install || req.query.installId
    if (!req.query.install) return next()

    // Skip unless location or beacons are provided
    var loc = (req.query.location && req.query.location.lat && req.query.location.lng)
    var beacons = (req.query.beacons && req.query.beacons.length)
    if (!(loc || beacons)) return next()

    var ops = {
      installId: req.query.install,
      userId: req.user ? req.user._id : util.statics.anonId,
      location: req.query.location,
      beaconIds: req.query.beacons,
      tag: req.dbOps.tag,
      log: req.query.log,
      test: req.query.test,
    }

    updateInstall(ops, function(err, install) {
      if (err) logErr('Error updating install for req ' + req.tag, err) // log don't fail
      if (install) req.install = install
      next()
    })
  })


  // If the request contains a client version check it
  app.all('*', function(req, res, next) {
    if (req.query.version) return validateClientVersion(req, res, next)
    next()
  })


  // Check all posts for valid content-type header
  app.post('*', checkContentType)
  app.put('*', checkContentType)

  function checkContentType(req, res, next) {

    // Support mixed-case header key
    if (req.headers['Content-Type']) {
      req.headers['content-type'] = req.headers['Content-Type']
      delete req.headers['Content-Type']
    }

    // Support mixed-case header key
    if (req.headers['Content-type']) {
      req.headers['content-type'] = req.headers['Content-type']
      delete req.headers['Content-type']
    }

    // Require json
    if (!req.headers['content-type']) {
      return res.error(perr.badRequest('Missing header content-type'))
    }
    var contentType = req.headers['content-type'].toLowerCase()
    if (!/^application\/json/.test(contentType)) {
      if (!/^\/signin/.test(req.path)) {  // for the signin html form
        return res.error(perr.badRequest('Invalid content-type: ' + contentType +
          ' Expected: application/json'))
      }
    }
    next()
  }
}



// Load routes from the routes directory.  Route order is not garanteed,
// so cross-route dependencies should be made explicity
function addRoutes(app) {
  util.callAll(routeDir, 'init', app)
  util.callAll(routeDir, 'addRoutes', app)
}


function addPostRoutes(app) {
  // Nobody answered, fall through
  app.all('*', function(req, res) {
    return res.error(perr.notFound())
  })
}

module.exports = app
