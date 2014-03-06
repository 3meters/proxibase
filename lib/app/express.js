/**
 * express.js
 *
 *   Extend the express response prototype
 */

var config = util.config
var express = require('express')
var _send = express.response.send

express.response.send = function() {

  // Pass through html
  if (this.isHtml) return _send.apply(this, arguments)

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

  logRes(req, this, body, statusCode)

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
function logRes(req, res, body, statusCode) {
  if (!config.log) return
  var isErr = (statusCode >= 500) ? true : false
  var msg = '==== Res: ' + req.tag + ', time: ' + req.timer.read() +
      ', statusCode: ' + statusCode
  if (isErr || config.log > 1) log(msg, body)
  else log(msg)
  // On server errors if stderr is not the console fork a full
  // corpse of the failure to stderr
  if (isErr && !process.stderr.isTTY) {
    logErr('Server Error on ' + util.nowFormatted(), {
      req: {
        tag: req.tag,
        ip: req.ip,
        headers: req.headers,
        url: req.url,
        body: (req.body) ? req.body : undefined,
      },
      res: {
        statusCode: statusCode,
        body: body,
      }
    })
  }
}

module.exports = express
