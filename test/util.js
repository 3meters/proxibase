/*
 * Proxibase test util module
 */

var 
  fs = require('fs'),
  assert = require('assert'),
  log = require('../lib/util').log,
  _baseUri = 'https://api.localhost:8043'

// if config.json exists and is well-formed point the tests at the specified server
try {
  var configJson = fs.readFileSync('./config.json', 'utf8')
  _baseUri = JSON.parse(configJson).server
} catch (err) {
  log('\nCould not find or parse config.json. Testing default server')
}

log('\nTesting ' + _baseUri)

var getBaseUri = exports.getBaseUri = function() {
  return _baseUri
}

// Parse response.  Bail with assert on fail
exports.check = function(res, test, code) {
  code = code || 200
  assert(res && res.statusCode, 'Server not responding')
  test.ok(res.statusCode === code, 'Bad statusCode: ' + res.statusCode + ' expected: ' + code)
  if (res.body) try {
    res.body = JSON.parse(res.body)
  } catch (e) {
    throw new Error('res.body is not valid JSON')
  }
}

// genterate a request options object template that can be safely modified
exports.getOptions = function(path, body) {
  if (!path) path = ''
  else {
    if (path.indexOf('/') != 0) path = '/' + path  // prepend slash if not already present
  }
  var options = {
    uri: getBaseUri() + path,
    headers: { "content-type": "application/json" }
  }
  if (body) {
    try {
      body = JSON.stringify(body)
    } catch (e) {
      throw new Error("Could not convert body to JSON\n" + e.stack)
    }
    options.body = body
  }
  return options
}


