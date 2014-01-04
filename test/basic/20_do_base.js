/**
 * Proxibase base web method tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var userCred = ''
var adminCred = ''
var testUser1 = {}
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.echo = function(test) {
  var rBody = {foo: {bar: {baz: 'foo'}}}
  t.post({
    uri: '/do/echo',
    body: rBody
  }, function(err, res, body) {
    t.assert(body.foo.bar.baz === rBody.foo.bar.baz)
    // TODO:  get t.assert to inherit from assert and do t.assert.deepequal(body, rBody)
    test.done()
  })
}


exports.simpleFind = function(test) {
  t.post({
    uri: '/do/find?' + userCred,
    body: {collection: 'users'}
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data instanceof Array && body.data.length)
    test.done()
  })
}


exports.findWithLimitNotSignedIn = function(test) {
  var limit = 2
  t.post({
    uri: '/do/find',
    body: {collection:'places', limit: limit}
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data instanceof Array)
    t.assert(body.count === limit)
    t.assert(body.data.length === limit)
    t.assert(body.more === true)
    test.done()
  })
}


exports.findById = function(test) {
  t.post({
    uri: '/do/find?' + adminCred,
    body: {collection:'users', ids:[constants.uid1]}
  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0]._id === constants.uid1)
    testUser1 = body.data[0]
    test.done()
  })
}


exports.findByNameCaseInsensitive = function(test) {
  t.post({
    uri: '/do/find?' + adminCred,
    body: {collection:'users', name: testUser1.name.toUpperCase(), sort: {_id: -1}}
  }, function(err, res, body) {
    t.assert(body.data.length === 2 && body.count === 2) //Test users 1 and 10
    t.assert(body.data[1]._id === constants.uid1)
    test.done()
  })
}


exports.findPassThrough = function(test) {
  t.post({
    uri: '/do/find?' + adminCred,
    body: {collection:'users', find:{email: testUser1.email}}
  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0].email === testUser1.email)
    test.done()
  })
}

