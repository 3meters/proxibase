/*
 * Proxibase test util module
 */

var
  assert = require('assert'),
  util = require('../lib/util'),
  constants = require('./constants'),
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
  if (req.method !== 'get' && req.body) {
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


// Synthesize a beacon Id
exports.genBeaconId = function(recNum) {
  var id = pad(recNum + 1, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableIds.beacons, 4) + ':' // TODO: change to '.'
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
var genId = exports.genId = function(tableName, recNum) {
  assert((typeof tableIds[tableName] === 'number'), 'Invalid table name ' + tableName)
  tablePrefix = pad(tableIds[tableName], 4)
  recNum = pad(recNum + 1, 6)
  return tablePrefix + '.' + constants.timeStamp + '.' + recNum
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

