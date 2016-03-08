/**
 * Proxibase standard errors passed to util.error.init
 *
 */
module.exports = {

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
  emailNotFound: {
    code: 401.4,
    message: 'Email address not found'
  },
  emailNotValidated: {
    code: 401.5,
    message: 'Email address not validated'
  },
  locked: {
    code: 401.6,
    message: 'Locked'
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
  likelyDupe: {
    code: 403.11,
    message: 'Likely duplicate found'
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
  excededLimit: {
    code: 403.3,
    message: 'You have exceded a limit',
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
    message: 'An unxpected server error has occured'
  },

  systemError: {
    code: 500,
    message: 'An unexpected system error has occured'
  },

  // 501
  serverErrorNYI: {
    code: 501,
    message: 'Server Error, not yet implemented'
  },

  // 502
  partnerError: {
    code: 502,
    message: 'Server Error, a partner service returned an error'
  },

  // 510
  timeout: {
    code: 510,
    message: 'Server Error, timeout'
  },
}
