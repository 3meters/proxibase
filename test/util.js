/*
 * Proxibase test util module
 */

var 
  fs = require('fs'),
  assert = require('assert'),
  log = require('../lib/log'),
  _baseUri = 'https://api.localhost:8043'

// if config.json exists and is well-formed point the tests at the specified server
try {
  var configJson = fs.readFileSync('./config.json', 'utf8')
  _baseUri = JSON.parse(configJson).server
} catch (err) {
  log('\nCould not find or parse config.json. Testing default server')
}

log('\nTesting ' + _baseUri)

exports.getBaseUri = function() {
  return _baseUri
}

// Parse response.  Bail with assert on fail
exports.parseRes = function(res, code) {
  code = code || 200
  assert(res && res.statusCode, 'Server not responding')
  assert(res.statusCode === code, 'Bad statusCode: ' + res.statusCode)
  res.body = JSON.parse(res.body)
  assert(res.body, 'Problem parsing res.body')
  if (res.body.data) assert(res.body.data instanceof Array, 'Bad res.body.data')
}


