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

exports.countByDeliversSomeResults = function(test) {
  t.get({
    uri: '/data/links/count/_owner'
  }, function(err, res, body) {
    // These are based on data in template test database
    t.assert(body.count >= profile.users)
    body.data.forEach(function(agg) {
      if (0 === agg._owner.indexOf(testUserIdPrefix)) {
        t.assert(agg.countBy)  // Testing the expected value is hard
      }
    })
    test.done()
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
          t.assert(elm.countBy)
          break
        default:
          t.assert(false, 'Unexpected type ' + elm.type)
      }
    })
    test.done()
  })
}
