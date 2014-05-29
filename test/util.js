/**
 * Proxibase test util module
 */

var util = require('proxutils')
var log = util.log
var tipe = util.tipe
var _ = util._
var assert = require('assert')
var request = require('request')
var constants = require('./constants')

assert(tipe.isTruthy, 'The proxibase utils are not loaded properly, bailing')
util.setConfig('configtest.js')

// Base Uri all test requests call, can be overridden by callers
exports.serverUrl = util.config.service.url


// set some default test request options
function makeReq(options) {

  var req = {}
  if (tipe.isString(options)) {
    options = {method: 'get', uri: options}
  }
  _.extend(req, options)

  var versionPath = '/v1'
  if (options.uri) req.uri = exports.serverUrl + versionPath + options.uri
  else req.uri = exports.serverUrl

  req.method = options.method || 'get'
  req.json = tipe.isBoolean(options.json) ? options.json : true
  req.strictSSL = false  // Defaulted to false with node.0.8, in node 0.10 it defaults to true
  return req
}

//
// Test class that makes the original req and respone
// objects available as corpes for failed asserts
//
//   var t = require('util').treq
//
// exports.mytest = function(test)
//   var options = { uri: '/data/users' }
//   t.get(options, 200, function(err, res, body) {
//      t.assert(body.data.count)
//      test.done()
//   }
// }
//
function TestRequest() {
  var _req
  var _res

  // Main method
  function treq(options, statusCode, cb) {
    if (arguments.length < 3 && (tipe.isFunction(statusCode))) {
      // status code not included, shift left and set default
      cb = statusCode
      statusCode = 200
    }
    var req = makeReq(options)
    _req = req
    if (!cb) return request(req) // fire and forget
    request(req, function(err, res) {
      if (err) throw err
      _res = res
      check(req, res, statusCode)
      cb(err, res, res.body)
    })
  }

  // Assert wrapper that calls dump automatically on failure
  function tok(expr, msg) {
    if (!expr) throw new Error(dump(_req, _res, msg))
  }

  // get request
  function tget(options, statusCode, cb) {
    options.method = 'get'
    treq.apply(null, arguments)
  }

  // post request
  function tpost(options, statusCode, cb) {
    options.method = 'post'
    treq.apply(null, arguments)
  }

  // delete request
  function tdelete(options, statusCode, cb) {
    options.method = 'delete'
    treq.apply(null, arguments)
  }

  // public methods
  var public = {
    req: treq,
    get: tget,
    post: tpost,
    delete: tdelete,
    del: tdelete,
    ok: tok,
    assert: tok
  }
  return public
}


var testUser = {
  name: 'Test User',
  type: 'user',
  email: 'test@3meters.com',
  password: 'foobar',
}

var adminUser = {
  name: 'Test Admin User',
  type: 'user',
  email: 'admin',
  password: 'admin',
}

function makeTestUser() {
  var seed = String(Math.floor(Math.random() * 1000000))
  return {
    name: 'Test User ' + seed,
    email: 'test' + seed + '@3meters.com',
    password: 'foobar',
  }
}

function getUserSession(user, cb) {
  if (!cb) {
    cb = user
    user = makeTestUser()
  }
  getSession(user, false, cb)
}

function getAdminSession(user, cb) {
  if (!cb) {
    cb = user
    user = adminUser
  }
  getSession(user, true, cb)
}

function skip(test, msg) {
  var out = '      WARNING! The following test did not pass, it was skipped: '
  out += msg ? msg : ''
  log(out)
  test.done()
}

/*
 * Get a new session for a user, optionally as admin
 * If the user does not exist in the system, create him first
 * Perhaps rename ensureUserAndGetSession?
 */
function getSession(user, asAdmin, cb) {

  var body = util.clone(user)
  body.installId = '123456'
  var req = makeReq({
    method: 'post',
    uri: '/auth/signin',
    body: body,
  })

  request(req, function(err, res, body) {
    if (err) throw (err)
    if (res.statusCode === 200) return finish(res)
    else {
      if (asAdmin) {
        util.logErr('res.body', body)
        throw new Error('Cannot sign in with default admin credentials')
      }
      // create user
      var req = makeReq({
        method: 'post',
        uri: '/user/create',
        body: {data: user, secret: 'larissa', installId: '123456'},
      })
      request(req, function(err, res) {
        if (err) throw err
        check(req, res)
        finish(res)
      })
    }

    function finish(res) {
      assert(res.body.session)
      assert(res.body.user)
      cb(res.body.session, res.body.user)
    }
  })
}

// Disgourge req and res contents of failed test
function dump(req, res, msg) {

  var out = '\n\nTest failed: '

  if (msg) {
    out += (tipe.isObject(msg) || tipe.isArray(msg))
      ? '\n' + util.inspect(msg, false, 12)
      : String(msg)
  }

  out += '\n\nDump:\n==========================='

  out += '\nreq.method: ' + req.method
  out += '\nreq.uri: ' + req.uri

  if (req.body) {
    out += '\nreq.body:\n' + util.inspect(req.body, false, 12) + '\n'
  }

  if (res.statusCode) out += '\n\nres.statusCode: ' + res.statusCode + '\n'

  out += 'res.body:\n' + util.inspect(res.body, false, 12)

  // util.inspect converts all our newlines to the literal '\n'
  // this next line converts them back for proper display on the console
  out = out.replace(/\\n/g, '\n')
  out += ('\n==========================\n')

  return out
}


// Ensure response, check status code, parse body
function check(req, res, code) {
  assert(req, 'Missing request')
  assert(res, 'Missing response')
  assert(res.statusCode, 'Missing response.statusCode')
  code = code || 200
  if (req.body && tipe.isString(req.body)) {
    try { req.body = JSON.parse(req.body) }
    catch (e) { } // we allow non-JSON in request body
  }
  if (res.body && (tipe.isString(res.body))) {
    try { res.body = JSON.parse(res.body) }
    catch (e) {
      if (req.json) {
        util.logErr('Server did not return valid JSON in res.body:\n', res.body)
        throw e
      }
    }
  }
  if (code !== res.statusCode) {
    throw new Error(dump(req, res,
        'Bad statusCode: ' + res.statusCode + ' expected: ' + code))
  }
}


// Synthesize a beacon Id
exports.genBeaconId = function(recNum) {
  var id = pad(recNum + 1, 12)
  id = delineate(id, 2, ':')
  var prefix = util.statics.schemas.beacon.id + '.'
  return  prefix + id
}


// Put sep in string s at every freq. return delienated s
var delineate = exports.delineate = function(s, freq, sep) {
  var cSeps = Math.floor(s.length / freq)
  for (var out = '', i = 0; i < cSeps; i++) {
    out += s.slice(0, freq) + sep
    s = s.slice(freq)
  }
  return out.slice(0,-1) + s // trim the last sep and add the remainder
}


// Make a standard _id field for a table with recNum as the last id element
var genId = exports.genId = function(schemaName, recNum) {
  var schemaId = util.statics.schemas[schemaName].id
  assert(schemaId, 'Invalid schema name')
  recNum = pad(recNum + 1, 6)
  return schemaId + '.' + constants.timeStamp + '.' + recNum
}

// create a digits-length string from number left-padded with zeros
var pad = exports.pad = function(number, digits) {
  var s = number.toString()
  assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s)
  for (var i = digits - s.length, zeros = ''; i--;) {
    zeros += '0'
  }
  return zeros + s
}

exports.getUserSession = getUserSession
exports.getAdminSession = getAdminSession
exports.treq = TestRequest()
exports.dump = dump
exports.check = check
exports.request = request
exports.skip = skip
exports.db = 1   // set by test.js after connection
exports.config = util.config
