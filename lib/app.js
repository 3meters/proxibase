/*
 * app.js
 *
 * Express app definition and top-level router
 *
 */


require('./http/methods')  // extends express
require('./http/errors')   // creates global HttpErr constructor and httpErr map


var fs = require('fs')
  , url = require('url')
  , util = require('util')
  , express = require('express')
  , middleware = require('./http/middleware')
  , config = util.config
  , gdb = util.gdb
  , db = util.db
  , auth = require('./routes/auth')
  , app = express()
  , info = {}
  , siteUrl = config.service.url
  , log = util.log


app.configure(function() {

  app.use(express.static(__dirname + '/http/static'))
  app.use(middleware.tagger())
  app.use(express.bodyParser())
  if (config.log) app.use(middleware.logger())
  app.use(app.router)
  app.use(middleware.errorHandler())


  // Initalize globally cached objects
  info.site = {
    name: config.service.name,
    version: config.service.version,
    clients: siteUrl + '/client',
    schemas: siteUrl + '/schema',
    data: siteUrl + '/data',
    admin: siteUrl + '/admin',
    methods: siteUrl + '/do',
    languages: siteUrl + '/langs',
    errors: siteUrl + '/errors',
    docs: 'https://github.com/3meters/proxibase#readme'
  }
  info.data = {}
  info.schema = {}

  Object.keys(db.cNames).forEach(function(name) {
    info.data[name] = siteUrl + '/data/' + name
    info.schema[name] = siteUrl + '/schema/' + name
  })

  app.info = info
})


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
  // parseUrlQry(req, res)
  next()
})


// If a post contains lang, user, or session params hoist them to req.query
app.post('*', function(req, res, next) {
  if (req.body) {
    if (req.body.lang && !req.query.lang) req.query.lang = req.body.lang
    if (req.body.user && !req.query.user) req.query.user = req.body.user
    if (req.body.session && !req.query.session) req.query.session = req.body.session
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


// Check all posts for valid content-type header
app.post('*', function(req, res, next) {
  if (!req.headers['content-type']) {
    return res.error(400, 'Missing header content-type')
  }
  var contentType = req.headers['content-type'].toLowerCase()
  if (contentType.indexOf('application/json') != 0) {
    return res.error(400, 'Invalid content-type: ' + contentType +
      ' Expected: application/json')
  }
  next()
})


/*
 * Client routes, used to define what versions of clients the service
 *   is compatible with.  Update the document in the database called client.
 */
app.get('/client', function(req, res, next) {
  util.db.documents.findOne({name:'client'}, function(err, doc) {
    if (err) return res.error(err)
    if (doc) res.send(doc.data)
    else res.send({
      notes: 'returns mongodb.documents[\'client\'].data if exists, else this sample:',
      android: {
        required: '3.0.2',
        stable: '3.1.3',
        head: '3.2.2'
      }
    })
  })
})

// User management
require('./routes/user').addRoutes(app)

// Authencation
auth.addRoutes(app)

// API site index page
app.get('/', function(req, res) {
  res.send(info.site)
})

// Schema index page
app.get('/schema', function(req, res) {
  res.send({schema:info.schema})
})

// Individual schema pages
app.get('/schema/*', function(req, res) {
  req.paths.shift() // remove leading /schema
  req.modelName = req.paths.shift()
  if (!gdb.models[req.modelName]) {
    return res.error(httpErr.notFound)
  }
  res.send({schema: gdb.schemaDocs[req.modelName]})
})

// Admin Routes
require('./routes/admin').addRoutes(app)

// Sever languages
app.get('/langs', function(req, res) {
  res.send({langs: util.statics.langs})
})

// Errors index page
app.get('/errors', function(req, res) {
  res.send({errors: httpErr})
})

// Custom methods
require('./routes/do').addRoutes(app)

// Rest methods
require('./routes/data').service(app)

// Stats methods
require('./routes/stats')(app)

// Fall through
app.all('*', function(req, res, next) {
  return res.error(httpErr.notFound)
})

// Export app
module.exports = app
