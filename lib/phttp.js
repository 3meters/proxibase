
/*
 * phttp:  Proxibase extensions to node's and express's http
 */

var
  Response = require('http').ServerResponse.prototype,
  _expressSend = Response.send,  // Stash express's send method
  assert = require('assert'),
  util = require('./util'),
  config,
  log = util.log


// Extend Express and Node's http implementation, primarily for logging and
// custom error handling.  This may not work with Express 3
exports.extendHttp = function(conf) {

  config = conf

  // Extend Express's res.send with a version that logs response times
  Response.send = function(body, statusCode) {
    statusCode = parseInt(statusCode) || 200
    var req = this.req
    // true if request came with a valid user name and session key
    if (req.user && body && !body.user) {
      body.user = {_id: req.user._id, name: req.user.name}
    }
    logRes(req, body, statusCode)
    if (typeof body === 'object') body = JSON.stringify(body)
    logPerf(req, body.length)
    _expressSend.call(this, body, statusCode)
  }


  // Send a nicely formatted error to a client that expects JSON
  Response.error = Response.sendErr = function(err, statusCode) {
    statusCode = parseInt(statusCode) || 500

    var req = this.req, body = {}
    body.error = {}

    // Caller passed in a number matching one of our known http errors
    if (typeof(err) === 'number' && httpErrMap[err]) {
      err = new HttpErr(httpErrMap[err])
    }

    // Caller passed in an httpErr object member, new up the HttpErr
    if ((!(err instanceof Error)) &&
        typeof(err) === 'object' &&
        err.code && 
        httpErrMap[err.code]) {
      err = new HttpErr(err)
    }

    // One of our known errors
    if (err instanceof HttpErr) {
      statusCode = parseInt(err.code)

      // Proof-of-concept localization
      if (err.langs && err.langs[req.lang]) {
        err.message = err.langs[req.lang]
      }
      delete err.langs
    }

    // Give up and let Error try to figure out what the caller meant
    if (!(err instanceof Error)) err = new Error(err)

    // Now we have an error with a stack trace, format the response
    for (key in err) {
      body.error[key] = err[key]
    }
    if (err.stack) {
      body.error.appStack = getAppStack(err.stack)
    }
    if (err.stack && config.log > 2) {
      body.error.stack = err.stack
    }

    this.send(body, statusCode)
  }

}


// Format and write log entry for response
function logRes(req, body, statusCode) {
  assert(statusCode && (typeof statusCode === 'number'), 'Response is missing statusCode')
  assert(req.tag, 'Request is missing tag: ' + util.inspect(req))
  if (config.log) {
    req.time = req.timer.read()
    req.startTime = req.timer.base()
    log('==== Response ' + req.tag + ', time ' + req.time + ', statusCode ' + statusCode)
    if (statusCode >= 500 || (statusCode >= 400 && config.log > 1)) {
      log('body:', body)
    }
  }
}


// Log the request time in CSV format in the perf log
function logPerf(req, bodyLength) {
  if (config.perfLog && config.perfLogFile) {
    config.perfLogFile.write(req.tag + ',' + bodyLength + ',' +
      req.startTime + ',' + req.time + '\n')
  }
}


// Creates a stack that filters out calls in node_modules
function getAppStack(oldStack) {
  var lines = []
  oldStack.split('\n').forEach(function(line) {
    if (line.indexOf('node_modules') < 0) lines.push(line)
  })
  return lines.join('\n')
}


// Middleware that tags each request with a random ID and starts its timer
exports.tagger = function() {
  return function(req, res, next) {
    req.tag = Math.floor(Math.random() * 100000000).toString()
    req.timer = new util.Timer()
    return next()
  }
}


// Middleware that logs requests
exports.logger = function() {
  return function(req, res, next) {
    log('\n==== Request ' + req.tag + ', received ' + req.timer.base())
    log(req.method + " " + req.url)
    if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
    return next()
  }
}


// Middleware to catch errors passed using next(err)
exports.errorHandler = function() {
  return function (err, req, res, next) {
    var statusCode = null
    if (!(err instanceof Error)) return next()
    if (err instanceof SyntaxError) statusCode = 400
    return res.error(err, statusCode)
  }
}


