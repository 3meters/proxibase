/*
 *  Proxibase rest basic test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
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

exports.countByWorks = function(test) {
  t.get({
    uri: '/data/links?countBy=_owner'
  }, function(err, res, body) {
    // These are based on data in template test database
    var testUserIdPrefix = 'us.010101'
    var testLinkOwnerCount = 220
    t.assert(body.count >= 10)
    t.assert(body.data[0]._owner.indexOf(testUserIdPrefix) === 0)
    body.data.forEach(function(agg) {
      if (0 === agg._owner.indexOf(testUserIdPrefix)) {
        t.assert(testLinkOwnerCount <= agg.countBy)
      }
    })
    test.done()
  })
}

exports.countByMultipleFieldsWorks = function(test) {
  t.get({
    uri: '/data/links?countBy=_owner,type'
  }, function(err, res, body) {
    // These are based on data in template test database
    t.assert(body.count >= 33)
    body.data.forEach(function(elm) {
      if (elm._owner.indexOf('us.010101') < 0) return
      switch (elm.type) {
        case 'content':
          t.assert(elm.countBy === 100)
          break
        case 'proximity':
          t.assert(elm.countBy <= 10)
          break
        case 'like':
          t.assert(elm.countBy === 100)
          break
        case 'watch':
          t.assert(elm.countBy === 100)
          break
        case 'create':
          t.assert(elm.countBy === 110)
          break
        default:
          t.assert(false, 'Unexpected type ' + elm.type)
      }
    })
    test.done()
  })
}



