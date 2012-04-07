
/*
 * Test /__do/find
 */

var
  request = require('request'),
  assert = require('assert'),
  util = require('../../lib/util'),
  log = util.log,
  testUtil = require('../util'),
  constants = require('../constants'),
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

exports.findById = function(test) {
  req.uri = baseUri + '/__do/find'
  req.body = JSON.stringify({table:'users', ids:[constants.uid1]})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data instanceof Array, dump(req, res))
    assert(res.body.data.length === 1 && res.body.count === 1, dump(req, res))
    assert(res.body.data[0]._id === constants.uid1, dump(req, res))
    test.done()
  })
}

exports.findByNameCaseInsensitive = function(test) {
  req.uri = baseUri + '/__do/find'
  var name = constants.getDefaultRecord('users1').name.toUpperCase()
  req.body = JSON.stringify({table:'users', names:[name]})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data instanceof Array, dump(req, res))
    assert(res.body.data.length === 1 && res.body.count === 1, dump(req, res))
    assert(res.body.data[0]._id === constants.uid1, dump(req, res))
    test.done()
  })
}

exports.findPassThrough = function(test) {
  req.uri = baseUri + '/__do/find'
  var name = constants.getDefaultRecord('users2').name
  req.body = JSON.stringify({table:'users', find:{name:name}})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data instanceof Array, dump(req, res))
    assert(res.body.data.length === 1 && res.body.count === 1, dump(req, res))
    assert(res.body.data[0]._id === constants.uid2, dump(req, res))
    test.done()
  })
}

exports.touch = function(test) {
  req.uri = baseUri + '/__do/touch'
  req.body = JSON.stringify({table:'users'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.count && res.body.count > 0, dump(req, res))
    test.done()
  })
}


