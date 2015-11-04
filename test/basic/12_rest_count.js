/*
 *  Proxibase rest basic test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var profile = constants.dbProfile.smokeTest
var testUserIdPrefix = 'us.010101'
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


_exports.countBasicAndFiltered = function(test) {
  t.get('/data/links/count',
  function(err, res, body) {
    t.assert(body.count)
    t.assert(body.count > 100)
    var countUnfiltered = body.count

    t.get('/data/links/count?q[fromSchema]=user',
    function(err, res, body) {
      t.assert(body.count)
      t.assert(body.count < countUnfiltered)
      test.done()
    })
  })
}

exports.countFiltersPrivateCollectionsByOwner = function(test) {
  t.get('/data/messages/count',
  function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}


exports.countFailsForSystemCollections = function(test) {
  t.get('/data/sessions/count',
  401, function(err, res, body) {
    test.done()
  })
}


exports.countByDeliversSomeResults = function(test) {
  t.get({
    uri: '/data/links/count/_owner'
  }, function(err, res, body) {
    var unfilteredMap = {}
    // These are based on data in template test database
    t.assert(body.count >= profile.users + 1)  // admin
    t.assert(body.data)
    var nAggs = 0
    body.data.forEach(function(agg) {
      t.assert(agg._owner)
      if (0 === agg._owner.indexOf(testUserIdPrefix)) {
        t.assert(agg.count)  // Testing the expected value is hard
        nAggs++
        unfilteredMap[agg._owner] = agg
      }
    })
    t.assert(nAggs)

    t.get({
      uri: '/data/links/count/_owner?q[toSchema]=patch'
    }, function(err, res, body) {
      nAggsFiltered = 0
      t.assert(body.count >= profile.users + 1)  // admin
      t.assert(body.data)
      body.data.forEach(function(agg, i) {
        if (0 === agg._owner.indexOf(testUserIdPrefix)) {
          t.assert(agg.count)
          t.assert(agg.count < unfilteredMap[agg._owner].count)
          nAggsFiltered++
        }
      })
      t.assert(nAggsFiltered)
      test.done()
    })
  })
}


exports.countByMultipleFieldsReturnsResults = function(test) {
  t.get({
    uri: '/data/links/count/_owner,type'
  }, function(err, res, body) {
    // These are based on data in template test database
    t.assert(body.count >= profile.users)
    body.data.forEach(function(elm) {
      if (elm._owner.indexOf(testUserIdPrefix) < 0) return
      switch (elm.type) {
        case 'content':
        case 'proximity':
        case 'like':
        case 'watch':
        case 'create':
          t.assert(elm.count)
          break
        default:
          t.assert(false, 'Unexpected type ' + elm.type)
      }
    })
    test.done()
  })
}


