
/*
 * phttp:  Proxibase extensions to node's and express's http
 */

var
  Response = require('http').ServerResponse.prototype,
  util = require('./util'),
  HttpError = util.HttpError,
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
      if (req.session && !body.session) body.session = req.session
      _expressSend.call(this, body, headers, statusCode)
    }
  }


  // Send a nicely formatted error to a client that expects JSON
  Response.error = Response.sendErr = function(err, statusCode, logError) {
    var 
      req = this.req, 
      body = {}

    body.error = {}

    if (err instanceof HttpError) {
      // HttpErrors include status code in the first object, shift logError param left
      logError = statusCode
      statusCode = parseInt(err.code)
      if (err.message && 
          (!(typeof(err.message) === 'string')) &&
          err.message[req.lang]) {
        // send localized error message
        err.message = err.message[req.lang]
      }
      for (key in err) {
        body.error[key] = err[key]
      }
    }
    else {
      statusCode = parseInt(statusCode) || 400
      body.error.name = 'Error'
      body.error.message = 'Unexpected error message. Call for help.'
      if (typeof err === 'number') {
        statusCode = err
        if (err === 400) body.error.message = "Invalid request"
        if (err === 404) body.error.message= "Not found"
        if (err === 500) body.error.message= "Unexpected server error"
      } else if (typeof err === 'string') {
        body.error.message = err
      } else if (err instanceof Error) {
        if (err.name) body.error.name = err.name
        if (err.message) body.error.message = err.message
        if (err.code) {
          body.error.code = err.code
          var n = parseInt(err.code)
          if (n) statusCode = n
        }
        if (err.errors) body.errors = err.errors
      } else if (err instanceof Object) {
        body.error = err
      }
    }
    if (logError || statusCode >= 500 || config.log > 1) {
      log({response: {
        tag: req.tag,
        statusCode: statusCode,
        body: body
      }})
    }
    this.send(body, statusCode)
  }

}


// Middleware to catch errors
exports.errorTrap = function() {
  return function (err, req, res, next) {
    if (!err instanceof Error) return next()
    // Don't log SyntaxErrors, which are usually unparsable JSON in a post body
    if (!err instanceof SyntaxError) {
      log('Express error for req ' + req.tag + ' ' + err.stack||err, false, 5)
    }
    return res.error(err)
  }
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

