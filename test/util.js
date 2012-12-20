/*
 * Proxibase test util module
 */

var util = require('util')
var log = util.log
var assert = require('assert')
var request = require('request')
var constants = require('./constants')


// Load the proxibase extensions if they haven't already been loaded
if (!util.truthy) require('../lib/extend')

// Extend node's util with parameters from the test config file
util.setConfig('configtest.js')


// Base Uri all test requests call, can be overridden by callers
exports.serverUrl = util.config.service.url


// Request options constructor
// Note that default method is post, not get
var Req = exports.Req = function(options) {

  // Make sure caller uses new
  if (!(this instanceof arguments.callee)) {
    throw new Error('Req must be called as a constructor with new')
  }

  for (key in options) {
    this[key] = options[key]
  }

  if (this.uri) this.uri = exports.serverUrl + this.uri
  else this.uri = exports.serverUrl

  this.method = this.method || 'post'

  if (this.body) {
    try { this.body = JSON.stringify(this.body) }
    catch (e) { throw e }
  }

  this.headers = {"content-type":"application/json"}
  if (!this.method) this.method = 'get'

}

//
// Experimental test class that shares the most recent
// request and response with the assert wrapper
//
//   var t = require('util').T()
//
//exports.mytest = function(test)
//   t.req(options, statusCode, function(err, res) {
//      t.ok(false)
//      test.done()
//   }
//}
exports.T = function() {
  var _req = {}
  var _res = {}
  return {
    req: treq,
    ok: tok
  }
}

// Assert wrapper that calls dump automatically on failure
var tok = function(expr, msg) {
  assert(expr, dump(_req, _res, msg))
}

// Wrapper wrapper
var treq = function(options, statusCode, cb) {
  if (arguments.length < 3 && (typeof statusCode === 'function')) {
    // status code not included, shift left and set default
    cb = statusCode
    statusCode = 200
  }
  var req = new Req(options)
  _req = req
  request(req, function(err, res) {
    _res = res
    check(req, res, statusCode)
    cb(err, res)
  })
}


var testUser = {
  name: 'Test User',
  email: 'test@3meters.com',
  password: 'foobar'
}

var adminUser = {
  email: 'admin',
  password: 'admin'
}

exports.getUserSession = function(user, fn) {
  if (!fn) {
    fn = user
    user = testUser
  }
  getSession(user, false, fn)
}


exports.getAdminSession = function(user, fn) {
  if (!fn) {
    fn = user
    user = adminUser
  }
  getSession(user, true, fn) 
}


/*
 * Get a new session for a user, optionally as admin
 * If the user does not exist in the system, create him first
 * Perhaps rename ensureUserAndGetSession?
 */
function getSession(user, asAdmin, fn) {

  var req = new Req({
    uri: '/auth/signin',
    body: {user: user}
  })

  request(req, function(err, res) {
    if (err) throw (err) 
    if (res.statusCode >= 400) {
      if (asAdmin) throw new Error('Cannot sign in with default admin credentials')
      // create user
      var req = new Req({
        uri: '/user/create',
        body: {data: user, noValidate: true, secret: 'larissa'},
      })
      request(req, function(err, res) {
        if (err) throw err
        check(req, res)
        assert(res.body.user)
        assert(res.body.session)
        fn(res.body.session)
      })
    }
    else {
      res.body = JSON.parse(res.body)
      assert(res.body.session)
      fn(res.body.session)
    }
  })
}

// Disgourge req and res contents of failed test
var dump = exports.dump = function(req, res, msg) {

  var out = msg || 'Test failed:'
  out += '\n\nDump:\n==========================='

  out += '\nreq.method: ' + req.method
  out += '\nreq.uri: ' + req.uri

  if (req.body) {
    out += '\nreq.body:\n' + util.inspect(req.body) + '\n'
  }

  if (res.statusCode) out += '\n\nres.statusCode: ' + res.statusCode + '\n'

  out += 'res.body:\n' + util.inspect(res.body)

  // util.inspect converts all our newlines to the literal '\n'
  // this next line converts them back for proper display on the console
  out = out.replace(/\\n/g, '\n')
  out += ('\n==========================\n')

  return out
}


// Ensure response, check status code, parse body
var check = exports.check = function(req, res, code) {
  assert(req, 'Missing request')
  assert(res, 'Missing response')
  assert(res.statusCode, 'Missing response.statusCode')
  code = code || 200
  if (req.body) {
    try { req.body = JSON.parse(req.body) }
    catch (e) { } // we allow non-JSON in request body
  }
  if (res.body) {
    try { res.body = JSON.parse(res.body) }
    catch (e) { console.error(res.body); throw e }
  }
  assert(code === res.statusCode,
    dump(req, res, 'Bad statusCode: ' + res.statusCode + ' expected: ' + code))
}


// Synthesize a beacon Id
exports.genBeaconId = function(recNum) {
  var id = pad(recNum + 1, 12)
  id = delineate(id, 2, ':')
  var prefix = tableIds.beacons + '.'
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
var genId = exports.genId = function(collectionName, recNum) {
  var collectionId = util.statics.collectionIds[collectionName]
  assert(collectionId, 'Invalid collection name')
  recNum = pad(recNum + 1, 6)
  return collectionId + '.' + constants.timeStamp + '.' + recNum
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

