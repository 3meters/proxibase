/**
 * proxutils/error.js
 *
 *   Proxibase errors:  generate a rest-ready error with a sensible
 *   name, message, and stack trace.
 */

var util = require('util')  // jshint ignore:line
var errMap = {}
var errCodeMap = {}
var proxError = {}


// init intializes based on map of errors and coded
function init(errs) {

  // Assign to module global
  errMap = module.exports.errMap = errs

  util.inherits(ProxErr, Error)
  ProxErr.prototype.name = 'ProxError'

  for (var key in errMap) {
    errCodeMap[errMap[key].code] = errMap[key] // reverse map by code
    makeProxErrFactory(key)  // errMap.foo => proxError.foo()
  }

  function makeProxErrFactory(key) {
    proxError[key] = function(message, info) {
      return new ProxErr(errMap[key], message, info)
    }
  }
}


/*
 * Proxibase Error constructor
 *
 * @template: (object) member of errMap
 * @message:  (string) optional caller message
 * @errors:   (any) optional caller suplimental error
 */
function ProxErr(template, callerMessage, callerInfo) {

  Error.stackTraceLimit = 200
  Error.captureStackTrace(this, this.constructor)

  for (var key in template) { this[key] = template[key] }
  this.name = 'ProxError'
  if (callerMessage) this.message += ': ' + callerMessage
  if (callerInfo) this.message += '\n\n' + util.inspect(callerInfo, false, 12) + '\n'
  this.status = parseInt(this.code) // Express promotes err.status to res.statusCode
}


module.exports = proxError
module.exports.init = init
module.exports.errMap = errMap
