
/*
 * Proxibase base web method tests
 */

var
  request = require('request'),
  assert = require('assert'),
  util = require('../../lib/util'),
  log = util.log,
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  constants = require('../constants'),
  userCred = '',
  adminCred = '',
  testUser1 = {},
  _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


exports.echo = function(test) {
  var req = new Req({
    uri: '/do/echo',
    body: {table: 'users'}
  })
  request(req, function(err, res) {
    check(req, res)
    delete (res.body.time)
    assert.deepEqual(req.body, res.body, dump(req, res))
    test.done()
  })
}


exports.simpleFind = function(test) {
  var req = new Req({
    uri: '/do/find?' + userCred,
    body: {table: 'users'}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data, dump(req, res))
    assert(res.body.data instanceof Array && res.body.data.length)
    test.done()
  })
}


exports.findWithLimitNotSignedIn = function(test) {
  var limit = 10
  var req = new Req({
    uri: '/do/find',
    body: {table:'entities', limit: limit}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data, dump(req, res))
    assert(res.body.data instanceof Array, dump(req, res))
    assert(res.body.count === limit, dump(req, res))
    assert(res.body.data.length === limit, dump(req, res))
    assert(res.body.more === true, dump(req, res))
    test.done()
  })
}


exports.findById = function(test) {
  var req = new Req({
    uri: '/do/find?' + userCred,
    body: {table:'users', ids:[constants.uid1]}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.length === 1 && res.body.count === 1)
    assert(res.body.data[0]._id === constants.uid1)
    testUser1 = res.body.data[0]
    test.done()
  })
}


exports.findByNameCaseInsensitive = function(test) {
  var req = new Req({
    uri: '/do/find?' + userCred,
    body: {table:'users', names:[testUser1.name.toUpperCase()]}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.length === 1 && res.body.count === 1)
    assert(res.body.data[0]._id === constants.uid1)
    test.done()
  })
}


exports.findPassThrough = function(test) {
  var req = new Req({
    uri: '/do/find?' + userCred,
    body: {table:'users', find:{email: testUser1.email}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.length === 1 && res.body.count === 1)
    assert(res.body.data[0].email === testUser1.email)
    test.done()
  })
}


exports.touchFailsForAnnonymous = function(test) {
  var req = new Req({
    uri: '/do/touch',
    body: {table: 'users'}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.touchFailsForUsers = function(test) {
  var req = new Req({
    uri: '/do/touch?' + userCred,
    body: {table: 'users'}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.touchWorksForAdmins = function(test) {
  var req = new Req({
    uri: '/do/touch?' + adminCred,
    body: {table: 'users'}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count)
    test.done()
  })
}


