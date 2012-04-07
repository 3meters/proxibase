
/*
 * Test /__do/find
 */

var
  request = require('request'),
  assert = require('assert'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq()

req.method = 'post'

exports.echo = function(test) {
  req.uri = baseUri + '/__do/echo'
  var body = {table:'users'}
  req.body = JSON.stringify(body)
  request(req, function(err, res) {
    check(req, res)
    assert.deepEqual(res.body, body, dump(req, res))
    test.done()
  })
}

exports.simpleFind = function(test) {
  req.uri = baseUri + '/__do/find'
  req.body = JSON.stringify({table:'users'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data instanceof Array, dump(req, res))
    test.done()
  })
}
