
/*
 * Express helpers, extensions, and custom middleware
 */

var
  Response = require('http').ServerResponse.prototype,  // For extending using the same pattern as Express
  config = require('./main').config,
  util = require('./util'),
  log = util.log

module.exports.extendExpress = function(perfLog) {

  // Stash express's send method
  var _expressSend = Response.send

  if (config.log && config.log.level) {

    // Override Express's res.send with a version that logs response times
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
        if (perfLog) {
          perfLog.write(req.tag + ',' + body.length + ',' + req.startTime + ',' + req.time + '\n')
        }
      }
      _expressSend.call(this, body, headers, statusCode)
    }
  }


  // Send a nicely formatted error to a client that expects JSON
  Response.sendErr = function(err, statusCode) {
    statusCode = parseInt(statusCode) || 400
    var body = {}
    body.name = 'Error'
    body.error = 'Unexpected error message. Call for help.'
    if (typeof err === 'number') {
      statusCode = err
      if (err === 400) body.error = "Bad request"
      if (err === 404) body.error = "Not found"
      if (err === 500) body.error = "Unexpected server error"
    } else if (typeof err === 'string') {
      body.error = err
    } else if (err instanceof Error) {
      if (err.name) body.name = err.name
      if (err.message) body.error = err.message
      if (err.code) body.code = err.code
      if (err.errors) body.errors = err.errors
    }
    this.send(body, statusCode)
  }
}


// Middleware to catch errors
module.exports.errorTrap = function() {
  return function (err, req, res, next) {
    if (!err) next()
    // Don't log SyntaxErrors, which are usually unparsable JSON in a post body
    if (!err instanceof SyntaxError) {
      log('Express error for req ' + req.url + ' ' + err.stack||err, false, 5)
    }
    return res.sendErr(err)
  }
}


// Middleware that tags each request with a random ID and starts its timer
module.exports.tagger = function() {
  return function(req, res, next) {
    req.tag = Math.floor(Math.random() * 100000000).toString()
    req.timer = new util.Timer()
    return next()
  }
}


// Middleware that logs requests
module.exports.logger = function() {
  return function(req, res, next) {
    log('\n==== Request ' + req.tag + ' received  ' + req.timer.base())
    log(req.method + " " + req.url)
    if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
    return next()
  }
}

