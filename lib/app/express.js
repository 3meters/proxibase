/**
 * express.js
 *
 *   Extend the express response prototype
 */

var config = util.config
var assert = require('assert')
var express = require('express')
var _send = express.response.send

express.response.send = function(body) {

  body = body || {}
  var statusCode = 200

  if (arguments.length > 1) {  // res.send(statusCode, body)
    statusCode = arguments[0]
    body = arguments[1]
  }

  assert(statusCode === parseInt(statusCode))

  var req = this.req
  if (req.user && !body.user) {  // req was authenticated
    body.user = {_id: req.user._id, name: req.user.name}
  }

  logRes(req, body, statusCode)

  this.charset = 'utf-8'

  if (req.tag) {
    this.header('Content-Type', 'application/json')
    body.androidMinimumVersion = util.statics.clientVersion.data.androidMinimumVersion
  }
  if (req.timer) body.time = req.timer.read()
  if (req.upgrade) body.upgrade = true
  if (req.query && req.query.lang) body.lang = req.query.lang
  if (type.isObject(body)) body = JSON.stringify(body)

  logPerf(req, body.length)

  _send.call(this, statusCode, body)
}

// Send a nicely formatted error to a client that expects JSON
express.response.error = function(err, info) {

  var req = this.req
  var body = {error: {}}

  if (!(err instanceof Error)) err = new Error(err)

  // Proof-of-concept localization
  if (err.langs && err.langs[req.lang]) {
    err.message = err.langs[req.lang]
  }
  delete err.langs

  // Often bubbled up by Express bodyParser middleware due to
  //  unparsable JSON in request body
  if (err instanceof SyntaxError) err.status = 400

  if (info) err.info = info

  _.extend(body.error, err)

  // err.stack is not ennumerable
  body.error.appStack = util.appStack(err.stack)

  if (config.log && config.log > 1)
  body.error.stack = err.stack

  this.send(err.status || 500, body)
}

// Format and write log entry for response
function logRes(req, body, statusCode) {
  if (config.log) {
    if (req.tag) {
      req.time = req.timer.read()
      log('==== Response: ' + req.tag + ', time: ' + req.time +
          ', statusCode: ' + statusCode)
      if (statusCode >= 500 || (statusCode >= 400 && config.log > 1)) {
        log('body:', body)
        // Fork log to stdErr
        logErr('Server Error for request ' + req.tag + ' on ' + util.nowFormatted())
        logErr('body:', body)
      }
    }
    else {
      log('=== Untagged Request url: ' + req.url + ' statusCode: ' + statusCode)
    }
  }
}

// Log the request time in CSV format in the perf log
function logPerf(req, bodyLength) {
  //TODO: BUG: why is perfLogFile undefined in test?
  if (config.perfLog && config.perfLogFile) {
    config.perfLogFile.write(req.tag + ',' + bodyLength + ',' +
      req.startTime + ',' + req.time + '\n')
  }
}

module.exports = express
