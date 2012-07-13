/*
 * errors.js: proxibase http errors
 *
 *   Used as arguments to the HttpErr constructor, e.g.:
 *
 *     res.error(new HttpErr(httpErr.missingParams, ['param1', 'param2']))
 *
 *   Global on purpose for convenience. If you write to it in your code
 *     you will cause very hard-to-find bugs
 *
 */


/*
 * @global
 */
HttpErr = function(err, errors) {

  // Make sure caller uses new
  if (!(this instanceof arguments.callee)) {
    throw new Error('HttpErr must be called as a constructor with new')
  }

  // err is required for now, may relax later
  if (!err) throw new Error('Undefined err in HttpErr construtor')

  this.name = 'HttpError'
  this.code = 400
  this.message = 'Invalid Request'
  for (key in err) {
    this[key] = err[key]
  }
  this.errors = errors

}
HttpErr.prototype = new Error()
HttpErr.prototype.constructor = HttpErr


/*
 * @global
 * @localizable
 */
httpErr = {

  // 200
  ok: {code: 200},

  // 201
  created: {code: 201},

  // 301
  moved: {code: 301},

  // 400
  badRequest: {
    code: 400,
    message: 'Invalid request'
  },
  missingParams: {
    code: 400.1,
    message: 'Missing required inputs'
  },
  invalidValue: {
    code: 400.2,
    message: 'Invalid input value'
  },
  badUserAuthParams: {
    code: 400.21,
    message: 'Either password or oauthId is required'
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

  // 403
  forbidden: {
    code: 403,
    message: 'Forbidden'
  },
  noDupes: {
    code: 403.1,
    message: 'Duplicate value not allowed'
  },
  badUserPassword: {
    code: 403.21,
    message: 'Password too weak. Passwords must be at least 6 characters long, ' + 
      'not be part of your user name, and not be certain commmon words.'
  },
  mustChangePasswordViaApi: {
    code: 403.22,
    message: 'You can only change user passwords via the /auth/changepw api'
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
  }
}


/*
 * Maps numeric http codes to httpErr members
 * @global
 */
httpErrMap = {}


/*
 * Immediate function to create the global httpErrMap from the global httpErr
 * Runs on module load
 */
;(function makeHttpErrMap() {
  for (key in httpErr) {
    httpErrMap[httpErr[key].code] = httpErr[key]
  }
  // require('./util').log('debug: httpErrMap:', httpErrMap)
})() // call on module load
