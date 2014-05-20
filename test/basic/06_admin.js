/**
 *  Proxibase admin tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var db = testUtil.db   // raw mongodb connection object without mongoSafe wrapper
var t = testUtil.treq
var userSession
var userCred
var adminSession
var adminCred
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}


exports.validateTestData = function(test) {
  t.get('/admin/validate?' + adminCred, function(err, res, body) {
    t.assert(body.results)
    t.assert(body.schemaErrors)
    t.assert(body.schemaErrors.length === 0)
    test.done()
  })
}


exports.addSomeTestData = function(test) {

  var user1 = {_id: 'us.adminTestUser1', email: 'adminTestUser1@3meters.com'}
  var user2 = {_id: 'us.adminTestUser2', email: 'adminTestUser2@3meters.com'}

  var goodLink = {
    _id: 'li.gctest.goodlink',
    _from: user1._id,
    _to: user2._id,
    type: '0',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var badLink1 = {
    _id: 'li.gctest.badLink1',
    _from: user1._id,
    _to: user2._id,
    type: '1',
    fromSchema: 'BOGUS1',
    toSchema: 'user',
  }

  var badLink2 = {
    _id: 'li.gctest.badLink2',
    _from: user1._id,
    _to: user2._id,
    type: '2',
    fromSchema: 'user',
    toSchema: 'BOGUS2',
  }

  var badLink3 = {
    _id: 'li.gctest.badLink3',
    _from: 'BOGUS3',
    _to: user2._id,
    type: '3',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var badLink4 = {
    _id: 'li.gctest.badLink4',
    _from: user1._id,
    _to: 'BOGUS4',
    type: '4',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var links = [goodLink, badLink1, badLink2, badLink3, badLink4]

  db.collection('users').insert([user1, user2], function(err) {
    assert(!err, err)
    db.collection('links').insert(links, function(err, result) {
      assert(!err, err)
      assert(result && result.length === 5, result)
      test.done()
    })
  })
}

exports.collectGarbage = function(test) {
  t.get('/admin/gc?' + adminCred, function(err, res, body) {
    t.assert(body.removed)
    t.assert(body.removed.length === 4)
    db.collection('links').find({_id: /^li.gctest/}).count(function(err, count) {
      t.assert(!err, err)
      t.assert(count === 1)
      test.done()
    })
  })
}

exports.cleanup = function(test) {
  db.collection('links').remove({_id: /^li.gctest/}, function(err, count) {
    assert(!err, err)
    assert(count == 1, count)
    test.done()
  })
}
