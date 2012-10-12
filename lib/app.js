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
  , adminService = require('./routes/admin/main')
  , userService = require('./routes/user')
  , doService = require('./routes/do/main')
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


/*
 *  To use the node-inspector graphical debugger first start it in the
 *  background, then start prox in debug mode, breaking on the first line.
 *
 *     node-inspector &
 *     node --debug-brk prox.js
 *
 *  Then in the chrome debugger (url will follow the startup message from
 *  node-inspector) hit play, you will stop here with all modules loaded.
 *  You may need to hit refresh in the debugger in order to see all modules.
 *  Each request will then break here.
 */
app.all('*', function(req, res, next) {
  debugger
  next()
})


// Parse pathname and query string
app.all('*', function(req, res, next) {
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
  if (req.query.user && !(req.query.user.password || req.query.session)) {
    return res.error(new HttpErr(httpErr.missingParam, 'session'))
  }
  if (req.query.session && !req.query.user) {
    return res.error(new HttpErr(httpErr.missingParam, 'user'))
  }
  if (req.query.user && req.query.session) {
    return auth.validateSession(req, res, next)
  }
  next()
})


// Check all posts for valid content-type header
app.post('*', function(req, res, next) {
  if (!req.headers['content-type']) {
    return res.error('Missing header content-type')
  }
  var contentType = req.headers['content-type'].toLowerCase()
  if (contentType.indexOf('application/json') != 0) {
    return res.error('Invalid content-type: ' + contentType +
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
app.post('/user/:method', userService.app)
app.get('/user/:method', userService.app)


// Authencation
auth.addRoutes(app)

/*
 * The user is now either annonymous or authenticated,
 * and the request is parsable and well-formed
 */


/*
 * Info routes
 */

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
app.all('/admin/?', adminService(app))

// Sever languages
app.get('/langs', function(req, res) {
  res.send({langs: util.statics.langs})
})

// Errors index page
app.get('/errors', function(req, res) {
  res.send({errors: httpErr})
})


/*
 * Web method routes
 */

app.get('/do', function(req, res) {
  return doService.get(req, res)
})

app.post('/do/*', function(req, res) {
  req.paths.shift() // remove leading do
  if (req.paths.length != 1)
    return res.error(new Error('Expected /do/methodname'))
  req.methodName = req.paths.shift()
  return doService.execute(req, res)
})

// Load routers
require('./routes/data').service(app)
require('./routes/stats')(app)


// fell through
app.all('*', function(req, res, next) {
  return res.error(404)  // no stack trace with numeric error code
})

// Export app
module.exports = app
