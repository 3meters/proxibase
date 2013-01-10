/*
 * extend/error.js
 *
 *   Proxibase errors:  generate an error with a sensible name, message,
 *   and stack trace.  Global on purpose for convenience and brevity.
 *   Don't write to globals.
 *
 *   The following produce the same result if msg and errs are null:
 *
 *     res.error(proxErr.notFound(msg, errs))               // preferred
 *     res.error(404)                                       // quick, no params
 */

var util = require('util')
var log = util.log
var errMap = {}
var errCodeMap = {}
var proxErr = {}


function exportGlobals() {
  global.perr = proxErr
  global.proxErr = proxErr
  global.ProxErr = ProxErr
  global.proxErrMap = errMap
  global.proxErrCodeMap = errCodeMap
}

/*
 * Proxibase Error constructor
 *
 * @template: (object) member of errMap
 * @message:  (string) optional caller message
 * @errors:   (any) optional caller suplimental error
 */
function ProxErr(template, callerMessage, callerInfo) {

  // Ensure caller uses new
  if (!(this instanceof arguments.callee)) {
    throw new Error('ProxErr must be called as a constructor with new')
  }

  if (!template) throw new Error ('Invalid call to ProxErr')

  Error.stackTraceLimit = 200
  Error.captureStackTrace(this, this.constructor)

  for (var key in template) { this[key] = template[key] }
  this.name = 'ProxError'
  this.message += callerMessage ? ': ' + callerMessage : ''
  this.status = parseInt(this.code) // Express promotes err.status to res.statusCode
  this.info = callerInfo
}

util.inherits(ProxErr, Error)
ProxErr.prototype.name = 'ProxError'

// Proxibase error map
errMap = {

  // 400
  badRequest: {
    code: 400,
    message: 'Invalid request'
  },
  missingParam: {
    code: 400.1,
    message: 'Missing required input'
  },
  badParam: {
    code: 400.11,
    message: 'Invalid input'
  },
  badType: {
    code: 400.12,
    message: 'Invalid input type'
  },
  badValue: {
    code: 400.13,
    message: 'Invalid input value'
  },
  badJSON: {
    code: 400.14,
    message: 'Invalid JSON'
  },
  badUserAuthParams: {
    code: 400.21,
    message: 'Either password or oauthId is required'
  },
  badSchemaId: {
    code: 400.3,
    message: 'Invalid schema id'
  },
  badVersion: {
    code: 400.4,
    message: 'Invalid version'
  },

  // 401
  badAuth: {
    code: 401,
    message: 'Unauthorized'
  },
  badAuthCred: {
    code: 401.1,
    message: 'Unauthorized credentials'
  },
  sessionExpired: {
    code: 401.2,
    message: 'Session expired'
  },
  notHuman: {
    code: 401.3,
    message: 'Not proved human'
  },

  // 403
  forbidden: {
    code: 403,
    message: 'Forbidden'
  },
  noDupes: {
    code: 403.1,
    message: 'Duplicate value not allowed'
  },
  badPassword: {
    code: 403.21,
    message: 'Password too weak. Passwords must be at least 6 characters long, ' + 
      'not be part of your user name, and not be certain commmon words.'
  },
  mustChangeViaApi: {
    code: 403.22,
    message: 'You can only change this value via an explicit api'
  },

  // 404
  // Optional localized error messages
  // Put ?lang=es in the request to test
  notFound: {
    code: 404,
    message: 'Not found',
    langs: {
      es: 'No se ha encontrado',
      la: 'non',
      ar: 'لم يتم العثور على',
      zh: '没有发现'
    }
  },

  // 500
  serverError: {
    code: 500,
    message: 'An unxpected server error has occured.  Call for help.'
  },

  // 501
  serverErrorNYI: {
    code: 501,
    message: 'Server Error: Not yet implemented'
  }
}

exports.init = function() {
  for (var key in errMap) {
    errCodeMap[errMap[key].code] = errMap[key] // reverse map by code
    makeProxErrFactory(key)  // errMap.foo => proxErr.foo()
  }
  function makeProxErrFactory(key) {
    proxErr[key] = function(message, errors) {
      return new ProxErr(errMap[key], message, errors)
    }
  }
  exportGlobals()
}
