/*
 * Http Methods:  extensions to node's and express's http methods
 */

var util = require('util')
  , log = util.log
  , assert = require('assert')
  , express = require('express')
  , config = util.config


/*
 * Extend express
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
  assert(body && statusCode === parseInt(statusCode), 'Invalid call to send')
  var req = this.req
  // true if request came with a valid user name and session key
  if (req.user && body && !body.user) {
    body.user = {_id: req.user._id, name: req.user.name}
  }
  logRes(req, body, statusCode)
  this.charset = 'utf-8'
  if (req.tag) this.header('Content-Type', 'application/json')
  if (req.timer) body.time = req.timer.read()
  if (typeof body === 'object') body = JSON.stringify(body)
  logPerf(req, body.length)
  _send.call(this, statusCode, body)
}


// Send a nicely formatted error to a client that expects JSON
express.response.error = function(err, info) {

  var req = this.req, body = {}
  body.error = {}

  // Caller passed in a number matching a known error code
  if (typeof(err) === 'number' && proxErrCodeMap[err]) {
    err = new ProxErr(proxErrCodeMap[err])
  }

  // Make an Error
  if (!(err instanceof Error)) err = new Error(err)
  assert(err.stack, 'Error lacks stack')

  // One of our known errors
  if (err instanceof ProxErr) {
    // Proof-of-concept localization
    if (err.langs && err.langs[req.lang]) {
      err.message = err.langs[req.lang]
    }
    delete err.langs
  }

  // Often bubbled up by Express bodyParser middleware due to
  //  unparsable JSON in request body
  if (err instanceof SyntaxError) err.status = 400

  // Cast duplicate value MongoError error as a ProxError
  if ('MongoError' === err.name && 11000 === err.code) {
    err = proxErr.noDupes(err.message)
  }

  if (info) err.info = info

  // Format the response
  for (var key in err) { body.error[key] = err[key] }

  // err.stack is not ennumerable
  body.error.appStack = util.appStack(err.stack)

  // Normaly errors are not logged.  Log the error if config.log is
  // set higher than the default
  if (config.log > 1) {
    util.logErr('appStack:', body.error.appStack)
    util.logErr('stack:', err.stack)
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
  if (config.perfLog && config.perfLogFile) {  //BUG: why is perfLogFile undefined in test?
    config.perfLogFile.write(req.tag + ',' + bodyLength + ',' +
      req.startTime + ',' + req.time + '\n')
  }
}


module.exports = express


