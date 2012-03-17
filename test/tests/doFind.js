
/*
 * Test /__do/find
 */

var
  request = require('request'),
  assert = require('assert'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  barf = testUtil.barf,
  baseUri = testUtil.getBaseUri(),
  req = testUtil.getDefaultReq()

req.method = 'post'

exports.echo = function(test) {
  req.uri = baseUri + '/__do/echo'
  var body = {table:'users'}
  req.body = JSON.stringify(body)
  request(req, function(err, res) {
    check(req, res)
    assert.deepEqual(res.body, body, barf(req, res))
    test.done()
  })
}

exports.simpleFind = function(test) {
  req.uri = baseUri + '/__do/find'
  req.body = JSON.stringify({table:'users'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data instanceof Array, barf(req, res))
    test.done()
  })
}
