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
var cookieParser = require('cookie-parser')     // for api explorer
var cookieSession = require('cookie-session')   // for api explorer
var bodyParser = require('body-parser')
var app = express()
var middleware = require('./middleware')
var routeDir = path.join(__dirname, '../routes')
var viewDir = path.join(__dirname, '../routes/explore')
var auth = require(path.join(routeDir, 'auth'))
var validateClientVersion = require(path.join(routeDir, 'client')).validate

require('./express')  // Extend Express


// Init on module load
init()


// Set up the app middleware and routes
function init() {

  app.use(favicon(path.join(__dirname, '../../assets/favicon.ico')))
  app.use(robots(path.join(__dirname, '../../assets/robots.txt')))

  // Set up views for api explorer
  app.set('views', viewDir)
  // app.set('view engine', 'jade')
  app.set('view engine', 'jsx');
  app.engine('jsx', require('express-react-views').createEngine({jsx: {harmony: true}}));


  app.use('/v1/assets/', serveStatic(path.join(__dirname, '../../assets')))

  app.use(middleware.tagger())
  app.use(compression())
  // see https://github.com/expressjs/body-parser
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(middleware.logger())
  app.use(middleware.requestLogger())
  app.use(middleware.apiVersioner())
  app.use(cookieParser())
  app.use(cookieSession({
    key: 'candi.sess',
    secret: 'yeudkdtyldishfdjfuetddywtwhd',
    cookie: {maxAge: 60 * 60 * 24 * 1000, httpOnly: false},
    proxy: true,
  }))
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

  function processBody(req, res, next) {
    if (req.body) {
      if (req.body.lang && !req.query.lang) req.query.lang = req.body.lang
      if (req.body.user && !req.query.user) req.query.user = req.body.user
      if (req.body.session && !req.query.session) req.query.session = req.body.session
      if (req.body.version && !req.query.version) req.query.version = req.body.version
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
    req.dbOps = {ip: req.ip}
    if (req.user) req.dbOps.user = req.user
    next()
  })


  // If the request contains a client version check it
  app.all('*', function(req, res, next) {
    if (req.query.version) return validateClientVersion(req, res, next)
    next()
  })


  // Check all posts for valid content-type header
  app.post('*', checkContentType)

  function checkContentType(req, res, next) {
    if (!req.headers['content-type']) {
      return res.error(perr.badRequest('Missing header content-type'))
    }
    var contentType = req.headers['content-type'].toLowerCase()
    if (!/^application\/json/.test(contentType)) {
      if (!/^\/explore/.test(req.path)) {  // for the api explorer
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
