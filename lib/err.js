/*
 * err.js: proxibase error codes
 */

exports = {
  ok: {code: 200},
  created: {code: 201},
  moved: {code: 301},
  badReq: {
    code: 400,
    message: 'Invalid request'
  },
  badReqParams: {
    code: 400.1,
    message: 'Invalid request parameters'
  },
  badAuth: {
    code: 401,
    message: 'Unauthorized'
  },
  badAuthCred: {
    code: 401.1,
    message: 'Unauthorized credentials'
  },
  notFound: {
    code: 404,
    message: 'Not found'
  }
}
