/**
 *  Proxibase stats basic test
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

exports.statsWelcomeWorks = function(test) {
  t.get({
    uri: '/stats'
  }, function(err, res, body) {
    test.done()
  })
}

exports.badStatName404s = function(test) {
  t.get({
    uri: '/stats/linksFromUsersBogus' + adminCred
  }, 404, function(err, res, body) {
    test.done()
  })
}


exports.statsCollectionCreatesFirstTimeAsAnnon = function(test){
  t.get({
    uri: '/stats/linksFromUsers'
  }, function(err, res, body){
    t.assert(body.data)
    t.assert(body.data.length)
    test.done()
  })
}


exports.cannotCreateStatsAsUser = function(test) {
  t.get({
    uri: '/stats/linksFromUsers?refresh=true&' + userCred
  }, 401, function(err, res, body){
    test.done()
  })
}

exports.statUserFilterWorks = function(test) {
  t.get({
    uri: '/stats/linksFromUsers/' + testUserId + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.data)
    oldLinkCount = 0
    body.data.forEach(function(stat) {
      oldLinkCount += stat.count
    })
    test.done()
  })
}

exports.adminCanRefreshStat = function(test) {
  t.get({
    uri: '/stats/linksFromUsers?refresh=true&' + adminCred
  }, function(err, res, body){
    t.assert(body.data.length)
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
      uri: '/stats/linksFromUsers/' + testUserId + '?refresh=true&' + adminCred
    }, function(err, res2, body){
      t.assert(body.data.length)
      var newLinkCount = 0
      body.data.forEach(function(stat) {
        newLinkCount += stat.count
      })
      t.assert(newLinkCount === oldLinkCount + 1)
      t.assert(body.data.some(function(stat) {
        return testUserId === stat._user
          && 'users' === stat.collection
          && 'like' === stat.linkType
      }))
      test.done()
    })
  })
}

exports.statsPassThroughQueryCriteria = function(test) {
  t.get({
    uri: '/stats/linksFromUsers?query[linkType]=watch'
  }, function(err, res, body) {
    t.assert(body.data.length)
    body.data.forEach(function(doc) {
      t.assert('watch' === doc.linkType)
    })
    test.done()
  })
}

exports.statsCanTurnLookupsOff = function(test) {
  t.get({
    uri: '/stats/linksFromUsers?lookups=0'
  }, function(err, res, body) {
    t.assert(body.data[0]._user)
    t.assert(!body.data[0].user)
    test.done()
  })
}
