
/*
 * Proxibase api server
 */

var
  fs = require('fs'),
  url = require('url'),
  express = require('express'),
  mongoose = require('mongoose'),
  _ = require('underscore'),
  util = require('./util'),
  config = require('./main').config,
  gdb = require('./main').gdb,
  rest = require('./rest'),
  methods = require('./methods/main'),
  log = util.log,
  perfLog


// Create and configurepublic app instance
var app = exports.app = express.createServer()
app
  .use(express.static(__dirname + '/public'))
  .use(express.bodyParser())
  .use(express.methodOverride())
  .use(express.cookieParser())
  .use(express.session({ secret: 'adabarks' }))
  .use(app.router)


// Create, open, and initialize the performance log file
if (config.log.perf) {
  var timer = new util.Timer()
  perfLog = fs.createWriteStream(config.log.perf, {encoding: 'utf8'})
  perfLog.write('RequestTag,Start,Time\n')
  perfLog.write('0,' + timer.base() + ',0\n')
  timer = undefined // not in a function, clean up
}


// Attach Error Helper
app.all('*', function(req, res, next) {
  res.sendErr = require('./util').sendErr
  next()
})


// Override Express's res.send with a version that logs response times
app.all('*', function(req, res, next) {
  res._send = res.send   // Stash express's send method
  res.send = function(arg1, arg2, arg3) {
    if (config.log.level > 1) {
      log('==== Request ' + req.tag + ' intermediate time: ' + req.timer.read())
    }
    res._send(arg1, arg2, arg3)
    /*
     * res.send is conditionally called twice intnerally by Express, first
     * to convert the body object to JSON, second to actually send the
     * response.  This code inpects the function signiture to differentiate
     * between these cases. This may break across Express upgrades, as the
     * types of res.send's arguments aren't explicitly public.
     */
    if (arg1 && arg3 && typeof arg1 === 'string' && typeof arg3 === 'number') {
      req.time = req.timer.read()
      req.startTime = req.timer.base()
      log('==== Request ' + req.tag + ' total time: ' + req.time)
      // Log the request time in CSV format
      if (config.log.perf) {
        perfLog.write(req.tag + ',' + req.startTime + ',' + req.time + '\n')
      }
    }
  }
  next()
})


// Start request timer and log requests
app.all('*', function(req, res, next) {
  req.tag = Math.floor(Math.random() * 100000000).toString()
  req.timer = new util.Timer()
  if (config.log && config.log.level) {
    log('\n==== Request ' + req.tag + ' ' + req.startDate)
    log(req.method + " " + req.url)
    if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
  }
  next()
})


// Uncaught exceptions including posts with unparsable JSON
app.error(function(err, req, res, next) {
  // Don't log json parse errors
  if (!err instanceof SyntaxError) {
    log('Express app.error for req.tag = ' + req.tag, err.stack||err, false, 5)
  }
  res.sendErr = require('./util').sendErr
  return res.sendErr(err)
})


// API site index page
app.get('/', function(req, res) {
  var root = "https://" + req.headers.host
  res.send({
    name: config.service.name + " API Server",
    docs: "https://github.com/georgesnelling/proxibase#readme",
    models: gdb.modelNames,
    modelDetails: root + '/__info',
    methods: root + '/__do'
  })
})


// Rest schema page
app.get('/__info', function(req, res) {
  var idMap = {}, out = { }
  for (var modelName in gdb.models) {
    idMap[gdb.models[modelName].tableId] = modelName
  }
  for (var i = 0; i < 1000; i++) {
    if (idMap[i]) out[idMap[i]] = i
  }
  res.send(out)
})


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
    return res.sendErr(new Error('Missing header content-type'))
  }
  var contentType = req.headers['content-type'].toLowerCase()
  if (contentType.indexOf('application/json') != 0) {
    return res.sendErr(new Error('Invalid content-type: ' + contentType +
      ' Expected: application/json'))
  }
  next()
})


/*
 * Web method routes
 */

app.get('/__do', function(req, res) {
  return methods.get(req, res)
})

app.post('/__do/*', function(req, res) {
  req.paths.shift() // remove leading __do
  if (req.paths.length != 1)
    return res.sendErr(new Error("Expected /__do/methodname"))
  if (!_.isEmpty(req.qryOptions))
    return res.sendErr(new Error("Parameters belong in request.body"))
  req.methodName = req.paths.shift()
  return methods.execute(req, res)
})


/*
 * Rest routes
 */

// matches /model /model/ or /model/..
var modelRE = new RegExp('(' + gdb.modelNames.join('|') + ')(/|$)')


// First path is a model name
app.all(modelRE, function(req, res, next) {
  req.modelName = req.paths.shift()
  req.model = gdb.models[req.modelName]
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


// If the first path was not a valid rest model, bail with 404, consider 400?
app.all('*', function(req, res, next) {
  if (!req.modelName) {
    return res.sendErr(404)
  }
  next()
})


// Final GET dispatcher
app.get('*', function(req, res) {

  // check remaining path elements
  if (req.paths.length) {

    // tableName/__info
    if (req.paths[0] === '__info') {
      var doc = gdb.models[req.modelName].schema.tree // tree is not doced and may be private
      delete doc.id
      return res.send(doc)
    }

    // tableName/__genId
    if (req.paths[0].toLowerCase() === '__genid') 
      return res.send({id: require('./util').genId(gdb.models[req.modelName].tableId)})

    // tablName/[__ids:id1,id2/]childTable1,childTable2
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
          return res.sendErr(new Error("Table " + req.modelName + " does not have child " + child))
      }
    }
    req.qry.children = children
  }
  var err = parseUrlQry(req, res)
  if (err) return res.sendErr(err)
  else return rest.get(req, res)
})


// Final POST dispatcher
app.post('*', function(req, res) {
  if (req.paths.length) return res.sendErr(404)
  if (!(req.body && req.body.data)) {
    return res.sendErr(new Error('request.body must contain { "data": {...} }'))
  }
  if (req.body.data instanceof Array && req.body.data.length != 1) {
    return res.sendErr(new Error('request.body.data[] may contain only one element'))
  }
  if (req.qry.ids) {
    return rest.update(req, res)
  } else {
    return rest.create(req, res)
  }
})


// Final DELETE dispatcher
app.delete('*', function(req, res) {
  if (req.paths.length) return res.sendErr(404)
  if (req.qry.ids || (req.body && req.body.ids)) {
    return rest.destroy(req, res)
  } else {
    return res.sendErr(404)
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
