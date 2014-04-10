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
    uri: '/data/tos?refresh=true&' + userCred
  }, 403, function(err, res, body){
    test.done()
  })
}

exports.adminCanRefreshTos = function(test) {
  t.get({
    uri: '/data/tos?refresh=true&' + adminCred
  }, function(err, res, body){
    t.assert(body.data.length)
    test.done()
  })
}

exports.adminCanRefreshfroms = function(test) {
  t.get({
    uri: '/data/froms?refresh=true&' + adminCred
  }, function(err, res, body){
    t.assert(body.data.length)
    test.done()
  })
}

exports.statFilterWorks = function(test) {
  t.get({
    uri: '/data/tos?query[_to]=' + testUserId + '&' + userCred
  }, function(err, res, body) {
    t.assert(body.data)
    oldLinkCount = 0
    body.data.forEach(function(stat) {
      oldLinkCount += stat.count
    })
    test.done()
  })
}


// Manually add a new link from the test user to the same user liking
// himself, then update the statistics and ensure that his new link
// appears in the stats
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
      uri: '/data/tos?query[_to]=' + testUserId + '&refresh=true&' + adminCred
    }, function(err, res2, body){
      t.assert(body.data.length)
      var newLinkCount = 0
      body.data.forEach(function(stat) {
        newLinkCount += stat.count
      })
      t.assert(newLinkCount === oldLinkCount + 1)
      t.assert(body.data.some(function(stat) {
        return testUserId === stat._to
          && 'user' === stat.toSchema
          && 'like' === stat.type
      }))
      test.done()
    })
  })
}

exports.statsPassThroughQueryCriteria = function(test) {
  t.get({
    uri: '/data/tos?query[_to]=' + testUserId + '&query[type]=like'
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
    uri: '/data/tos?query[_to]=' + testUserId + '&refs=true&' + userCred
  }, function(err, res, body) {
    t.assert(body.data[0]._to)
    t.assert(body.data[0].to)
    t.assert(body.data[0].to._id)
    t.assert(body.data[0].to.name)
    test.done()
  })
}

exports.statRefsDoNotPopulateForAnonUsers = function(test) {
  t.get({
    uri: '/data/tos?query[_to]=' + testUserId + '&refs=true'
  }, function(err, res, body) {
    t.assert(body.data[0]._to)
    t.assert(!body.data[0].to)
    test.done()
  })
}

// This depends on generated test data added in version 0.9.35
exports.doCountLinksToPlacesFromMessages = function(test) {
  t.post({
    uri: '/do/countLinksTo',
    body: [
      {$match: {$and: [
        {day: {$lt: '130315'}},
        {toSchema: 'place'},
        {fromSchema: 'message'},
      ]}},
      {$group: {
        _id: '$_to',
        count: {$sum: '$count'}
      }},
    ]
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    /*
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.category)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    */
    test.done()
  })
}

_exports.doCountLinksToPlacesTypeWatch = function(test) {
  t.get({
    uri: '/do/countLinksTo?query[toSchema]=place&query[type]=like',
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.category)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}

_exports.doCountCreatedLinksFromUsers = function(test) {
  t.get({
    uri: '/do/countLinksFrom?query[fromSchema]=user&query[type]=create',
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}

_exports.doCountPlacesByTunings = function(test) {
  t.get({
    uri: '/do/countLinksFrom?query[fromSchema]=place&query[type]=proximity',
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}
