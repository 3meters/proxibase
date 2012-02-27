
/**
 * Proxibase api server
 */

var
  fs = require('fs'),
  url = require('url'),
  express = require('express'),
  mongoose = require('mongoose'),
  _ = require('underscore'),
  config = require('../config'),
  mdb = require('./main').mdb,
  rest = require('./rest'),
  methods = require('./methods/main'),
  log = require('./util').log,
  sendErr = require('./util').sendErr,
  __info = '__info',
  __do = '__do'


// Create and configurepublic app instance
var app = exports.app = express.createServer()
app
  .use(express.static(__dirname + '/public'))
  .use(express.bodyParser())
  .use(express.methodOverride())
  .use(express.cookieParser())
  .use(express.session({ secret: 'adabarks' }))
  .use(app.router)


// Log requests
app.all('*', function(req, res, next) {
  log('============================== ' + Date())
  log(req.method + " " + req.url)
  if (req.method.toLowerCase() === 'post') log(req.body, 5)
  next()
})


// Uncaught exceptions including posts with unparsable JSON
app.error(function(err, req, res, next) {
  // TODO: don't log json parse errors
  log('Express app.error: ', err.stack||err, false, 5)
  return sendErr(res, err)
})


// API site index page
app.get('/', function(req, res) {
  var root = "https://" + req.headers.host
  res.send({
    name: config.name + " API Server",
    docs: "https://github.com/georgesnelling/proxibase#readme",
    models: mdb.modelNames,
    modelDetails: root + "/" + __info,
    methods: root + "/" + __do
  })
})


// Rest model info page
app.get('/' + __info, function(req, res) {
  var out = {}
  for (var modelName in mdb.models) {
    out[modelName] = modelInfo(modelName)
  }
  res.send(out)
})


// Helper returns the schema definition of the model
function modelInfo(modelName) {
  var doc = mdb.models[modelName].schema.tree // tree is not doced and may be private
  delete doc.id
  return doc
}


// Parse pathname and query string
app.all('*', function(req, res, next) {
  var urlObj = require('url').parse(req.url, true)
  var paths = urlObj.pathname.split('/')
  paths.shift() // remove leading empty element
  if (paths[paths.length - 1] === '') paths.pop() // url had trailing slash
  req.paths = paths
  req.urlQry = urlObj.query
  next()
})


// Check req headers
app.post('*', function(req, res, next) {
  if (!req.headers['content-type']) {
    return sendErr(res, new Error('Missing header content-type'))
  }
  var contentType = req.headers['content-type'].toLowerCase()
  if (contentType.indexOf('application/json') != 0) {
    return sendErr(res, new Error('Invalid content-type: ' + contentType +
      ' Expected: application/json'))
  }
  next()
})


/*
 * Web method routes
 */

app.get('/' + __do, function(req, res) {
  return methods.get(req, res)
})

app.post('/' + __do + "*", function(req, res) {
  req.paths.shift() // remove leading __do
  if (req.paths.length != 1)
    return sendErr(res, new Error("Expected /__do/methodname"))
  if (!_.isEmpty(req.qryOptions))
    return sendErr(res, new Error("Parameters belong in request.body"))
  req.methodName = req.paths.shift()
  return methods.execute(req, res)
})


/*
 * Rest routes
 */

// matches /model /model/ or /model/..
var modelRE = new RegExp('(' + mdb.modelNames.join('|') + ')(/|$)')


// First path is a model name
app.all(modelRE, function(req, res, next) {
  req.modelName = req.paths.shift()
  req.model = mdb.models[req.modelName]
  req.qry = {}
  // if the leading part of the next path element is the magic word __ids: or __names: parse and shift
  if (req.paths.length && req.paths[0].indexOf('__ids:') === 0) {
    req.qry.ids = req.paths[0].slice(6).split(',')
    req.paths.shift()
  } else if (req.paths.length && req.paths[0].indexOf('__names:') === 0) {
    req.qry.names = req.paths[0].slice(8).split(',')
    req.paths.shift()
  }
  next()
})


// If the first path was not a valid rest model, bail with 404
app.all('*', function(req, res, next) {
  if (!req.modelName)
    return res.send(notFound, 404)
  next()
})


// Final GET dispatcher
app.get('*', function(req, res) {

  // check remaining path elements
  if (req.paths.length) {

    // tableName/__info
    if (req.paths[0] === __info)
      return res.send(modelInfo(req.modelName))

    // tablName/[__ids:id1,id2/]childTable1,childTable2
    var children = req.paths[0].split(',')
    req.paths.shift()
    if (children[0] === '*') {
      children = []
      for (var table in mdb.models[req.modelName].schema.refChildren) {
        children.push(table)
      }
    } else {
      for (var i = children.length; i--;) {
        var child = children[i]
        if (!mdb.models[req.modelName].schema.refChildren[child])
          return sendErr(res, new Error("Table " + req.modelName + " does not have child " + child))
      }
    }
    req.qry.children = children
  }
  var err = parseUrlQry(req, res)
  if (err) return sendErr(res, err)
  else return rest.get(req, res)
})


// Final POST dispatcher
app.post('*', function(req, res) {
  if (req.paths.length) return sendErr(res, 404)
  if (!(req.body && req.body.data)) {
    return sendErr(res, new Error('request.body must contain { "data": {...} }'))
  }
  if (req.body.data instanceof Array && req.body.data.length != 1) {
    return sendErr(res, new Error('request.body.data[] may contain only one element'))
  }
  if (req.qry.ids) {
    return rest.update(req, res)
  } else {
    return rest.create(req, res)
  }
})


// Final DELETE dispatcher
app.delete('*', function(req, res) {
  if (req.paths.length) return res.send(notFound, 404)
  if (req.qry.ids) {
    return rest.destroy(req, res)
  } else {
    return res.send(notFound, 404)
  }
})


/*
 * Parse query options passed in on the URL. If there is an error return it, 
 * othewise set the rest query options on the req object and return nothing
 */
function parseUrlQry(req, res) {

  var parseQueryOptions = {

    __find: function(s) {
      try {
        var criteria = JSON.parse(s)
      } catch (e) {
        return new Error("Could not parse __find criteria as JSON")
      }
      req.qry.find = criteria
    },

    __fields: function(s) {
      req.qry.fields = s.split(',')
    },

    __lookups: function(s) {
      if (truthy(s)) req.qry.lookups = true
    },

    __limit: function(s) {
      var num = parseInt(s)
      if (num > 0) req.qry.limit = num
    }
  }

  for (var key in req.urlQry) {
    if (!parseQueryOptions[key])
      return new Error("Unrecognized query parameter " + key)
    var err = parseQueryOptions[key](req.urlQry[key])
    if (err) return err
  }
}

// s can be 'true' or any postive number
function truthy(s) {
  return s && s.length && (s === 'true' || parseInt(s) > 0)
}
