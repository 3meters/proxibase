/*
 * Http Methods:  extensions to node's and express's http methods
 */

var util = require('util')
  , assert = require('assert')
  , express = require('express')
  , config = util.config
  , log = util.log


/*
 * Extend Express
 *
 * @app express application instance
 */

// Stash Express's express's original send method
var _send = express.response.send

  // Extend Express's res.send with a version that logs response times
express.response.send = function(body) {

  body = body || {}
  var statusCode = 200
  if (arguments.length > 1) {  // res.send(statusCode, body)
    statusCode = arguments[0]
    body = arguments[1]
  }
  assert(body && statusCode === parseInt(statusCode))
  var req = this.req
  // true if request came with a valid user name and session key
  if (req.user && body && !body.user) {
    body.user = {_id: req.user._id, name: req.user.name}
  }
  logRes(req, body, statusCode)
  this.charset = 'utf-8';
  if (req.tag) this.header('Content-Type', 'application/json');
  if (typeof body === 'object') body = JSON.stringify(body)
  logPerf(req, body.length)
  _send.call(this, statusCode, body)
}


// Send a nicely formatted error to a client that expects JSON
express.response.sendErr =
express.response.error = function(err) {

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
    err.status = parseInt(err.code)

    // Proof-of-concept localization
    if (err.langs && err.langs[req.lang]) {
      err.message = err.langs[req.lang]
    }
    delete err.langs
  }

  // Often unparsable JSON in request body
  if (err instanceof SyntaxError) {
    err.status = 400
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
    util.logErr(err.stack)
  }

  this.send(err.status || 500, body)
}


// Format and write log entry for response
function logRes(req, body, statusCode) {
  assert(statusCode && (typeof statusCode === 'number'), 'Response is missing statusCode')
  if (config.log) {
    if (req.tag) {
      req.time = req.timer.read()
      req.startTime = req.timer.base()
      log('==== Response: ' + req.tag + ', time: ' + req.time + ', statusCode: ' + statusCode)
      if (statusCode >= 500 || (statusCode >= 400 && config.log > 1)) {
        log('body:', body)
      }
    }
    else {
      log('=== Untagged Request url: ' + req.url + ' statusCode: ' + statusCode)
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
function getAppStack(fullStack) {
  var lines = []
  fullStack.split('\n').forEach(function(line) {
    if (line.indexOf('node_modules') < 0) lines.push(line)
  })
  return lines.join('\n')
}

module.exports = express


