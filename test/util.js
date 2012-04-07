/*
 * Proxibase test util module
 */

var
  assert = require('assert'),
  util = require('../lib/util'),
  config = util.findConfig('configtest.js'),
  serverUrl = util.getUrl(config)


// Base Uri all test requests call, can be overridden by callers
exports.serverUrl = serverUrl


// All requests set content type
var getDefaultReq = exports.getDefaultReq = function() {
  return {
    headers:{"content-type":"application/json"}
  }
}


// Disgourge req and res contents of failed test
var dump = exports.dump = function(req, res, msg) {
  var out = msg || 'Test failed'
  out += '\n\nreq.method: ' + req.method
  out += '\nreq.uri: ' + req.uri
  if (req.method === 'post' && req.body) {
    out += '\nreq.body:\n' + util.inspect(req.body) + '\n'
  }
  if (res.statusCode) out += '\n\nres.statusCode: ' + res.statusCode + '\n'
  if (res.body) out += 'res.body:\n' + util.inspect(res.body) + '\n'
  return out
}


// Ensure response, check status code, parse body
exports.check = function(req, res, code) {
  assert(req, 'Invalide call to test.util.check.  Missing required req')
  assert(res && res.statusCode, dump(req, res, 'Fatal: No response'))
  code = code || 200
  assert(res.statusCode === code, dump(req, res,
    'Bad statusCode ' + res.statusCode + ' expected: ' + code))
  if (res.body) {
    try {
      res.body = JSON.parse(res.body)
    }
    catch (e) {
      assert(false, dump(req, res, 'Body did not contain valid JSON\n'))
    }
  }
}
