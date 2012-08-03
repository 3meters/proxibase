
/*
 * phttp:  Proxibase extensions to node's and express's http
 */

var
  Response = require('http').ServerResponse.prototype,
  util = require('./util'),
  assert = require('assert'),
  log = util.log


// Extend Express and Node's http implementation, primarily for logging and
// custom error handling
exports.extendHttp = function(config) {

  // Stash express's send method
  var _expressSend = Response.send

  if (config.log) {

    // Extend Express's res.send with a version that logs response times
    Response.send = function(body, headers, statusCode) {
      var req = this.req

      // res.send is conditionally called twice intnerally by Express, first
      // to convert the body object to JSON, second to actually send the
      // response.  This code inpects the function signiture to differentiate
      // between these cases. This may break across Express upgrades, as the
      // types of res.send's arguments aren't explicitly public. The req.tag
      // check is required because jason parse errors in posts will fire before
      // the request logger starts the timer.
      //
      if (req.tag && typeof body === 'string' && typeof statusCode === 'number') {
        req.time = req.timer.read()
        req.startTime = req.timer.base()
        log('==== Response ' + req.tag + ' time ' + req.time)
        // Log the request time in CSV format
        if (config.perfLog && config.perfLogFile) {
          config.perfLogFile.write(req.tag + ',' + body.length + ',' +
            req.startTime + ',' + req.time + '\n')
        }
      }
      // true if request came with a valid user name and session key
      if (req.user && !body.user) body.user = {_id: req.user._id, name: req.user.name}
      _expressSend.call(this, body, headers, statusCode)
    }
  }

  // Send a nicely formatted error to a client that expects JSON
  Response.error = Response.sendErr = function(err, statusCode) {

    var
      req = this.req,
      body = {}

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
    else {
      statusCode = parseInt(statusCode) || 400
    }

    // Give up and let Error try to figure out what the caller meant
    if (!(err instanceof Error)) err = new Error(err)

    // Now we have an error with a stack trace, format the response
    for (key in err) {
      body.error[key] = err[key]
    }
    if (err.stack && 
        (config.service.mode === 'development' ||
         config.service.mode === 'test')) {
      body.error.appStack = getAppStack(err.stack)
    }
    if (err.stack && config.service.log > 1) {
      body.error.stack = err.stack
    }

    // Log
    if (statusCode >= 500 || config.log.level >= 2) {
      log('res.error: ', {response: {
          tag: req.tag,
          statusCode: statusCode,
          body: body
        },
        error: err.stack||err
      })
    }

    this.send(body, statusCode)
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
    log('\n==== Request ' + req.tag + ' received  ' + req.timer.base())
    log(req.method + " " + req.url)
    if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
    return next()
  }
}


// Middleware to catch errors passed using next(err) 
exports.errorHandler = function() {
  return function (err, req, res, next) {
    if (!(err instanceof Error)) next()
    return res.error(err)
  }
}


