/**
 *  Proxibase link stats basic test
 *     linkStats is a computed collection
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var userSession
var userCred
var adminSession
var adminCred
var oldLinkCount

var testStartTime = util.now()
var _exports = {}  // For commenting out tests

exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUserId = session._owner
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}

exports.cannotCreateStatsAsUser = function(test) {
  t.get({
    uri: '/data/lstats?refresh=true&' + userCred
  }, 403, function(err, res, body){
    test.done()
  })
}

exports.adminCanRefreshStat = function(test) {
  t.get({
    uri: '/data/lstats?refresh=true&' + adminCred
  }, function(err, res, body){
    t.assert(body.data.length)
    // t.assert(false)
    test.done()
  })
}


exports.statFilterWorks = function(test) {
  t.get({
    uri: '/data/lstats?query[_from]=' + testUserId + '&' + userCred
  }, function(err, res, body) {
    t.assert(body.data)
    oldLinkCount = 0
    body.data.forEach(function(stat) {
      oldLinkCount += stat.count
    })
    test.done()
  })
}


// Add a new link from the test user liking himself, then update
// the statistics and ensure that his new link appears in the stats
exports.staticsUpdateOnRefresh = function(test) {
  t.post({
    uri: '/data/links?' + userCred,
    body: {
      data: {
        _from: testUserId,
        _to: testUserId,
        type: 'like'
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.get({
      uri: '/data/lstats?query[_from]=' + testUserId + '&refresh=true&' + adminCred
    }, function(err, res2, body){
      t.assert(body.data.length)
      var newLinkCount = 0
      body.data.forEach(function(stat) {
        newLinkCount += stat.count
      })
      t.assert(newLinkCount === oldLinkCount + 1)
      t.assert(body.data.some(function(stat) {
        return testUserId === stat._from
          && 'user' === stat.fromSchema
          && 'like' === stat.type
      }))
      test.done()
    })
  })
}

exports.statsPassThroughQueryCriteria = function(test) {
  t.get({
    uri: '/data/lstats?query[_from]=' + testUserId + '&query[type]=like'
  }, function(err, res, body) {
    t.assert(body.data.length)
    body.data.forEach(function(doc) {
      t.assert('like' === doc.type)
    })
    test.done()
  })
}

exports.statRefsWork = function(test) {
  t.get({
    uri: '/data/lstats?query[_from]=' + testUserId + '&refs=true&' + userCred
  }, function(err, res, body) {
    t.assert(body.data[0]._from)
    t.assert(body.data[0].from)
    t.assert(body.data[0].from._id)
    t.assert(body.data[0].from.name)
    test.done()
  })
}

exports.statRefsDoNotPopulateForAnonUsers = function(test) {
  t.get({
    uri: '/data/lstats?query[_from]=' + testUserId + '&refs=true'
  }, function(err, res, body) {
    t.assert(body.data[0]._from)
    t.assert(!body.data[0].from)
    test.done()
  })
}
