/*
 * err.js: proxibase http errors
 */

module.exports = {

  ok: {code: 200},
  created: {code: 201},
  moved: {code: 301},
  badRequest: {
    code: 400,
    message: {
      en: 'Invalid request'
    }
  },
  missingParams: {
    code: 400.1,
    message: {
      en: 'Missing required parameters'
    }
  },
  badUserAuthParams: {
    code: 400.21,
    message: {
      en: 'Either password or oauthId is required'
    }
  },
  badUserPassword: {
    code: 400.23,
    message: {
      en: 'Password too weak. Passwords must be at least 6 characters long, ' + 
      'not be part of your user name, and not be certain commmon words.'
    }
  },
  badAuth: {
    code: 401,
    message: {
      en: 'Unauthorized'
    }
  },
  badAuthCred: {
    code: 401.1,
    message: {
      en: 'Unauthorized credentials'
    }
  },
  forbidden: {
    code: 403,
    message: {
      en: 'Forbidden'
    }
  },
  mustChangePasswordViaApi: {
    code: 403.21,
    message: {
      en: 'You can only change user passwords via the /auth/changepw api'
    }
  },
  notFound: {
    code: 404,
    message: {
      en: 'Not found'
    }
  }
}

