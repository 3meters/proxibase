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
  , adminService = require('./routes/admin/main')
  , authService = require('./routes/auth/auth')
  , userService = require('./routes/user')
  , dataService = require('./routes/data')
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
    methods: siteUrl + '/do',
    languages: siteUrl + '/langs',
    errors: siteUrl + '/errors',
    docs: 'https://github.com/3meters/proxibase#readme'
  }
  info.data = {}
  info.schema = {}

  gdb.modelNames.forEach(function(name) {
    info.data[name] = siteUrl + '/data/' + name
    info.schema[name] = siteUrl + '/schema/' + name
  })

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
  var urlObj = url.parse(req.url, true)
  var paths = urlObj.pathname.split('/')
  paths.shift() // remove leading empty element
  if (paths[paths.length - 1] === '') paths.pop() // url had trailing slash
  req.paths = paths
  req.urlQry = urlObj.query
  parseUrlQry(req, res)
  next()
})


// If a post contains lang, user, or session params hoist them to req.qry
app.post('*', function(req, res, next) {
  if (req.body) {
    if (req.body.lang && !req.qry.lang) req.qry.lang = req.body.lang
    if (req.body.user && !req.qry.user) req.qry.user = req.body.user
    if (req.body.session && !req.qry.session) req.qry.session = req.body.session
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
  if (req.qry.user && req.qry.session) {
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
 * Client routes, used to define what versions of clients the service
 *   is compatible with.  Update the document in the database called client.
 */
app.get('/client', function(req, res, next) {
  util.db.collection('documents').findOne({name:'client'}, function(err, doc) {
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

/*
 * User Management routes
 */

app.post('/user/:method', userService.app)
app.get('/user/:method', userService.app)


/*
 * Authencation Routes
 */

app.get('/auth/:method/:service', authService.oauth)
app.all('/auth/:method', authService.local)


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

// Individual schema pages
app.get('/schema/*', function(req, res) {
  req.paths.shift() // remove leading /schema
  req.modelName = req.paths.shift()
  if (!gdb.models[req.modelName]) {
    return res.error(httpErr.notFound)
  }
  res.send({schema: gdb.schemas[req.modelName]})
})


// Admin Routes
app.get('/admin/:method', adminService.app)


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
  return doService.get(req, res)
})

app.post('/do/*', function(req, res) {
  req.paths.shift() // remove leading do
  if (req.paths.length != 1)
    return res.error(new Error('Expected /do/methodname'))
  if (req.qryOptions && Object.keys(req.qryOptions).length)
    return res.error(new Error('Parameters belong in request.body'))
  req.methodName = req.paths.shift()
  return doService.execute(req, res)
})


/*
 * Data routes (aka rest)
 */

// matches /data/model /data/model/ or /data/model/..
var modelRE = new RegExp('(' + gdb.modelNames.join('|') + ')(/|$)')


// Data routes: /data/<modelname>
app.all('/data/*', function(req, res, next) {

  req.paths.shift() // chop the leading /data
  req.modelName = req.paths.shift()
  if (!gdb.models[req.modelName]) {
    return res.error(httpErr.notFound)
  }

  req.model = gdb.models[req.modelName]

  // If the leading part of the next path element is one of the magic 
  //   words ids: or names: parse and shift
  if (req.paths.length && req.paths[0].indexOf('ids:') === 0) {
    req.qry.ids = req.paths[0].slice(4).split(',')
    req.paths.shift()
  } else if (req.paths.length && req.paths[0].indexOf('names:') === 0) {
    req.qry.names = req.paths[0].slice(6).split(',')
    req.paths.shift()
  }
  next()
})


// If you got here without a valid data model we don't know what you want
app.all('*', function(req, res, next) {
  if (!req.modelName) return res.error(httpErr.notFound)
  next()
})


// Data request is well-formed and parsed, check permissions
app.all('*', function(req, res, next) {
  dataService.checkPermissions(req, res, next)
})


// Final data get dispatcher
app.get('*', function(req, res) {

  // check remaining path elements
  if (req.paths.length) {

    // tableName/genId
    if (req.paths[0].toLowerCase() === 'genid') 
      return res.send({id: util.genId(gdb.models[req.modelName].tableId)})

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
  else return dataService.get(req, res)
})


// Final data post dispatcher
app.post('*', function(req, res) {
  if (req.paths.length) return res.error(404)
  if (!(req.body && req.body.data)) {
    return res.error(new HttpErr(httpErr.missingParam, 'data'))
  }
  if (req.body.data instanceof Array && req.body.data.length != 1) {
    return res.error('request.body.data[] may contain only one element')
  }
  if (req.qry.ids) {
    return dataService.update(req, res)
  } else {
    return dataService.create(req, res)
  }
})


// Final data delete dispatcher
app.delete('*', function(req, res) {
  if (req.paths.length) return res.error(404)
  if (req.qry.ids || (req.body && req.body.ids)) {
    return dataService.destroy(req, res)
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

    key: function(s) {
      req.qry.key = s
    },

    session: function(s) {
      req.qry.session = s
    },

    // TODO:  Move all route-specific query parameters down
    // into their route definition modules

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

    sort: function(s) {
      try {
        var sort = JSON.parse(s)
      }
      catch (e) {
        return res.error(new HttpErr(httpErr.badValue, 'Not valid JSON: sort'))
      }
      req.qry.sort = sort
    },

    skip: function(s) {
      req.qry.skip = parseInt(s)
    },

    count: function(s) {
      req.qry.count = truthy(s)
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


// returns boolean true for the string 'true' or any postive number, otherwise false
function truthy(s) {
  return s && s.length && (s.toLowerCase() === 'true' || parseInt(s) > 0)
}


// Export app
module.exports = app
