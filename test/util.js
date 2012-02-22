/*
 * Proxibase test util module
 */

var _baseUri = 'https://api.localhost:8043'

// uncomment to test production
// _baseUri = 'https://api.proxibase.com'

exports.getBaseUri = function() {
  log('\nURI: ' + _baseUri)
  return _baseUri
}

var
  assert = require('assert'),
  log = require('../lib/log')

log('\nTesting ' + exports._baseUri)

// Parse response.  Bail with assert on fail
exports.parseRes = function(res, code) {
  // the following works if a named function calls parse directly, but not when called from nodeunit
  // var caller = arguments.callee.caller.name || 'unknown'
  code = code || 200
  assert(res && res.statusCode && res.statusCode === code, "Bad res.statusCode")
  res.body = JSON.parse(res.body)
  assert(res.body && res.body.count === parseInt(res.body.count), "Bad res.body.count") // 0 is ok
  if (res.body.data) assert(res.body.data instanceof Array, "Bad res.body.data")
}


