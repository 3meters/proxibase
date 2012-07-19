
/*
 * Proxibase api server
 */

var
  fs = require('fs'),
  url = require('url'),
  express = require('express'),
  phttp = require('./phttp'),
  mongoose = require('mongoose'),
  _ = require('underscore'),
  util = require('./util'),
  config = require('./main').config,
  gdb = require('./main').gdb,
  authService = require('./main').authService,
  rest = require('./rest'),
  methods = require('./methods/main'),
  app,
  perfLog,
  info = {},
  siteUrl = config.service.url,
  log = util.log


// Create and configure the public express app instance on module load
app = express.createServer()
app
  .use(express.static(__dirname + '/public'))
  .use(express.bodyParser())
  .use(phttp.errorTrap())
  .use(phttp.tagger())
if (config.log) app.use(phttp.logger())
app.use(app.router)


// Initilize the site, data, and schema info objects
function init() {

  info.site = {
    name: config.service.name + ' API Server',
    version: config.service.version,
    schemas: siteUrl + '/schema',
    data: siteUrl + '/data',
    methods: siteUrl + '/do',
    languages: siteUrl + '/langs', 
    errors: siteUrl + '/errors',
    docs: 'https://github.com/georgesnelling/proxibase#readme'
  }
  info.data = {}
  info.schema = {}

  gdb.modelNames.forEach(function(name) {
    info.data[name] = siteUrl + '/data/' + name
    info.schema[name] = siteUrl + '/schema/' + name
  })
}


// Parse pathname and query string
app.all('*', function(req, res, next) {
  var urlObj = require('url').parse(req.url, true)
  var paths = urlObj.pathname.split('/')
  paths.shift() // remove leading empty element
  if (paths[paths.length - 1] === '') paths.pop() // url had trailing slash
  req.paths = paths
  req.urlQry = urlObj.query
  req.ip = req.header('x-forwarded-for') || req.connection.remoteAddress
  if (!req.ip) return res.error('Could not find client IP address', 500)
  parseUrlQry(req, res)
  next()
})


// If a post contains lang, user, or session params hoist them to req.qry
app.post('*', function(req, res, next) {
  if (req.body) {
    if (req.body.lang) req.qry.lang = req.body.lang
    if (req.body.user) req.qry.user = req.body.user
    if (req.body.session) req.qry.session = req.body.session
  }
  next()
})


// Set the default language per Royal British Navy AD 1600-1900
app.all('*', function(req, res, next) {
  req.lang = req.qry.lang || 'en'
  next()
})


// If request contains user and session token validate them
app.all('*', function(req, res, next) {
  if (req.qry.session && req.qry.user) {
    return authService.validateSession(req, res, next)
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
 * Authencation Routes
 */

// Sign in using our user account
app.post('/auth/signin', authService.signinLocal)

// Change local password
app.post('/auth/changepw', authService.changePassword)

// Route authentication requests to oauth service
app.get('/auth/signin/:service', authService) 

// Sign out
app.get('/auth/signout', authService.signout)


/*
 * The user is now either annonymous or authenticated, and the request is parsable
 * and bascially well-formed
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

// Data index page
app.get('/data', function(req, res) {
  res.send({data:info.data})
})

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
  return methods.get(req, res)
})

app.post('/do/*', function(req, res) {
  req.paths.shift() // remove leading do
  if (req.paths.length != 1)
    return res.error(new Error("Expected /do/methodname"))
  if (!_.isEmpty(req.qryOptions))
    return res.error(new Error("Parameters belong in request.body"))
  req.methodName = req.paths.shift()
  return methods.execute(req, res)
})


/*
 * Schema route
 */
app.get('/schema/*', function(req, res) {
  req.paths.shift() // remove leading /schema
  req.modelName = req.paths.shift()
  if (!gdb.models[req.modelName]) {
    return res.error(req.modelName + ' is not a valid table name')
  }
  res.send({schema: gdb.schemas[req.modelName]})
})


/*
 * Data routes
 */

// matches /data/model /data/model/ or /data/model/..
var modelRE = new RegExp('(' + gdb.modelNames.join('|') + ')(/|$)')

// Rest routes: /data/<modelname>
app.all('/data/*', function(req, res, next) {
  req.paths.shift() // chop the /data
  req.modelName = req.paths.shift()
  if (!gdb.models[req.modelName]) {
    return res.error(req.modelName + ' is not a valid table name')
  }
  req.model = gdb.models[req.modelName]
  // if the leading part of the next path element is one of the magic words ids: or names: parse and shift
  if (req.paths.length && req.paths[0].indexOf('ids:') === 0) {
    req.qry.ids = req.paths[0].slice(4).split(',')
    req.paths.shift()
  } else if (req.paths.length && req.paths[0].indexOf('names:') === 0) {
    req.qry.names = req.paths[0].slice(6).split(',')
    req.paths.shift()
  }
  next()
})


// If you got here without a valid rest model we don't know what you want
app.all('*', function(req, res, next) {
  if (!req.modelName) {
    //return res.error(new HttpErr(httpErr.notFound))
    return res.error(404)
  }
  next()
})


// Final rest get dispatcher
app.get('*', function(req, res) {

  // check remaining path elements
  if (req.paths.length) {

    // tableName/genId
    if (req.paths[0].toLowerCase() === 'genid') 
      return res.send({id: require('./util').genId(gdb.models[req.modelName].tableId)})

    // tablName/[ids:id1,id2/]childTable1,childTable2
    var children = req.paths[0].split(',')
    req.paths.shift()
    if (children[0] === '*') {
      children = []
      for (var table in gdb.models[req.modelName].schema.refChildren) {
        children.push(table)
      }
    } else {
      for (var i = children.length; i--;) {
        var child = children[i]
        if (!gdb.models[req.modelName].schema.refChildren[child])
          return res.error('Table ' + req.modelName + ' does not have child ' + child)
      }
    }
    req.qry.children = children
  }
  else return rest.get(req, res)
})


// Final rest post dispatcher
app.post('*', function(req, res) {
  if (req.paths.length) return res.error(404)
  if (!(req.body && req.body.data)) {
    return res.error('request.body must contain { "data": {...} }')
  }
  if (req.body.data instanceof Array && req.body.data.length != 1) {
    return res.error('request.body.data[] may contain only one element')
  }
  if (req.qry.ids) {
    return rest.update(req, res)
  } else {
    return rest.create(req, res)
  }
})


// Final rest delete dispatcher
app.delete('*', function(req, res) {
  if (req.paths.length) return res.error(404)
  if (req.qry.ids || (req.body && req.body.ids)) {
    return rest.destroy(req, res)
  } else {
    return res.error(404)
  }
})



// Helper parses query options passed in on the URL.  Known, well-formed params are added
// to the request qry object. Unknown parameters are ignored.
function parseUrlQry(req, res) {

  req.qry = {}

  var parseQueryOptions = {

    lang: function(s) {
      // Unknown languages will return in english
      req.qry.lang = s
    },

    user: function(s) {
      req.qry.user = s
    },

    session: function(s) {
      req.qry.session = s
    },

    oauth_token: function(s) {},
    oauth_verifier: function(s) {},

    find: function(s) {
      try {
        var criteria = JSON.parse(s)
      } catch (e) {
        return res.error('Could not parse find criteria as valid JSON')
      }
      req.qry.find = criteria
    },

    fields: function(s) {
      req.qry.fields = s.split(',')
    },

    lookups: function(s) {
      if (truthy(s)) req.qry.lookups = true
    },

    limit: function(s) {
      var num = parseInt(s)
      if (num > 0) req.qry.limit = num
    }
  }

  for (var key in req.urlQry) {
    if (parseQueryOptions[key]) parseQueryOptions[key](req.urlQry[key])
  }
}


// 'true' or any postive number
function truthy(s) {
  return s && s.length && (s.toLowerCase() === 'true' || parseInt(s) > 0)
}

// Module exports
exports.app = app
exports.init = init

