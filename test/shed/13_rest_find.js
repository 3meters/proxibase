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
var async = require('async')


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.simpleFind = function(test) {
  t.post({
    uri: '/find/users?' + userCred,
    body: {},
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data instanceof Array && body.data.length)
    test.done()
  })
}


exports.findWithLimitNotSignedIn = function(test) {
  var limit = 2
  t.post({
    uri: '/find/places',
    body: {limit: limit}
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
    uri: '/find/users?' + adminCred,
    body: {query: {_id: {$in: [constants.uid1]}}}
  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0]._id === constants.uid1)
    testUser1 = body.data[0]
    test.done()
  })
}


exports.findByNameCaseInsensitive = function(test) {
  t.post({
    uri: '/find/users?' + adminCred,
    body: {name: testUser1.name.toUpperCase(), sort: {_id: -1}}
  }, function(err, res, body) {
    body.data.forEach(function(user) {
      t.assert(user.name.match(/^Test User 1/i))
    })
    test.done()
  })
}


exports.findPassThrough = function(test) {
  t.post({
    uri: '/find/users?' + adminCred,
    body: {query:{email: testUser1.email}}
  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0].email === testUser1.email)
    test.done()
  })
}

exports.findFieldProjections = function(test) {
  t.post({
    uri: '/find/users?' + adminCred,
    body: {
      query:{email: testUser1.email},
      fields: {name: 1, email: 1},
    }

  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0].email === testUser1.email)
    t.assert(body.data[0].name === testUser1.name)
    t.assert(body.data[0]._id === testUser1._id)
    t.assert(!body.data[0]._owner)
    test.done()
  })
}

exports.findFieldProjectionsGetSyntax = function(test) {
  t.get({
    uri: '/find/users?query[email]=' + testUser1.email + '&fields=email,name,-_id&' + adminCred,
  }, function(err, res, body) {
    t.assert(body.data.length === 1 && body.count === 1)
    t.assert(body.data[0].email === testUser1.email)
    t.assert(body.data[0].name === testUser1.name)
    t.assert(!body.data[0]._id)
    t.assert(!body.data[0]._owner)
    test.done()
  })
}

exports.findNext = function(test) {
  t.get('/data/places/next', 401, function(err, res, body) {
    t.get('/data/places/next?' + adminCred, function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._id)
      var firstId = body.data._id
      t.assert(firstId)
      t.get('/data/places/next?' + adminCred, function(err, res, body) {
        t.assert(body.data._id > firstId)
        test.done()
        // TODO: check for rolling over by looping until hitting a limit (fail)
        // or finding an id === firstId
      })
    })
  })
}
