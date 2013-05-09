/**
 * proxutils/error.js
 *
 *   Proxibase errors:  generate a rest-ready error with a sensible
 *   name, message, and stack trace.
 */

var util = require('./')
var errMap = {}
var errCodeMap = {}
var proxErr = {}

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
  this.message += callerMessage ? ': ' + callerMessage : ''
  this.status = parseInt(this.code) // Express promotes err.status to res.statusCode
  this.info = callerInfo
}

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
  badSource: {
    code: 400.5,
    message: 'Invalid source'
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
  emailNotAuthorized: {
    code: 401.4,
    message: 'Email address not authorized'
  },
  emailNotValidated: {
    code: 401.5,
    message: 'Email address not validated'
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
    message: 'An unxpected server error has occured.'
  },

  // 501
  serverErrorNYI: {
    code: 501,
    message: 'Server Error: Not yet implemented'
  },

  // 502
  partnerError: {
    code: 502,
    message: 'Server Error: a partner service returned an error'
  }
}

function init() {

  util.inherits(ProxErr, Error)
  ProxErr.prototype.name = 'ProxError'

  for (var key in errMap) {
    errCodeMap[errMap[key].code] = errMap[key] // reverse map by code
    makeProxErrFactory(key)  // errMap.foo => proxErr.foo()
  }
  function makeProxErrFactory(key) {
    proxErr[key] = function(message, info) {
      return new ProxErr(errMap[key], message, info)
    }
  }
}

exports = module.exports = proxErr
exports.init = init
