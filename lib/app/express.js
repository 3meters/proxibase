/**
 * express.js
 *
 *   Extend the express response prototype
 */

var config = util.config
var express = require('express')
var _send = express.response.send

express.response.send = function() {

  var args = Array.prototype.slice.apply(arguments)
  var statusCode
  var body

  if (tipe.isError(args[0])) {
    return express.response.error.apply(this, arguments)
  }

  args.forEach(function(arg) {
    if (!statusCode && tipe.isNumber(arg)) statusCode = arg
    if (!body && tipe.isObject(arg)) body = arg
  })

  body = body || {}
  statusCode = statusCode || 200
  statusCode = Math.floor(statusCode)

  var req = this.req
  if (req.user && !body.user) {  // req was authenticated
    body.user = {_id: req.user._id, name: req.user.name}
  }

  logRes(req, body, statusCode)

  this.charset = 'utf-8'

  if (req.tag) {
    this.header('Content-Type', 'application/json')
    body.androidMinimumVersion = util.config.clientVersion.androidMinimumVersion
  }
  if (req.timer) body.time = req.timer.read()
  if (req.upgrade) body.upgrade = true
  if (req.query && req.query.lang) body.lang = req.query.lang
  if (tipe.isObject(body)) body = JSON.stringify(body)

  _send.call(this, statusCode, body)
}


// Send a nicely formatted error to a client that expects JSON
express.response.error = function(err, body) {

  var req = this.req
  body = body || {}
  body.error = {}

  if (tipe.isNull(err) || tipe.isUndefined(err)) {
    return express.response.send.call(this, body)
  }

  if (!tipe.isError(err)) err = new Error(err)

  // Proof-of-concept localization
  if (err.langs && err.langs[req.lang]) {
    err.message = err.langs[req.lang]
  }
  delete err.langs

  // Often bubbled up by Express bodyParser middleware due to
  //  unparsable JSON in request body
  if (err instanceof SyntaxError) err.status = 400

  // We recognize err codes from tipe
  if (err.code && perr.errMap[err.code]) {
    err.code = perr.errMap[err.code].code  // badType => 400.12
    err.status = parseInt(err.code)           // http statusCode 400
  }

  // if (info) err.details = info

  body.error.message = err.message

  // add all enumerable properties
  _.extend(body.error, err)

  // err.stack is not ennumerable
  body.error.appStack = util.appStack(err.stack, true)

  if (config.log && config.log > 1)
  body.error.stack = err.stack.split('\n')

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

module.exports = express
