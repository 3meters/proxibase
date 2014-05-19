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
    uri: '/stats/to/refresh?' + userCred
  }, 403, function(err, res, body){
    test.done()
  })
}

exports.adminCanRefreshTos = function(test) {
  t.get({
    uri: '/stats/to/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body.data)
    t.assert(body.data.cmd)
    t.assert(body.data.results)
    test.done()
  })
}

exports.adminCanRefreshFroms = function(test) {
  t.get({
    uri: '/stats/from/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body.data)
    t.assert(body.data.cmd)
    t.assert(body.data.results)
    test.done()
  })
}

exports.adminCanRefreshAll = function(test) {
  t.get({
    uri: '/stats/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body.data)
    t.assert(body.data.to)
    t.assert(body.data.to.cmd)
    t.assert(body.data.to.results)
    t.assert(body.data.from)
    t.assert(body.data.from.cmd)
    t.assert(body.data.from.results)
    test.done()
  })
}


// These test the underlying computed collections that live in 
// mongodb mapReduce format, not the nicer format provided by stats
exports.statFilterWorks = function(test) {
  t.get({
    uri: '/find/tos?query[_id._to]=' + testUserId
  }, function(err, res, body) {
    t.assert(body.data)
    oldLinkCount = 0
    body.data.forEach(function(stat) {
      oldLinkCount += stat.value
    })
    test.done()
  })
}


// Manually add a new link from the test user to the same user liking
// himself, then update the statistics and ensure that his new link
// appears in the persisted stats collection
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
    t.get('/stats/to/refresh?' + adminCred, function(err, res, body) {
      t.assert(body.data.cmd)
      t.assert(body.data.results)
      t.get({
        uri: '/find/tos?query[_id._to]=' + testUserId + '&' + userCred
      }, function(err, res2, body) {
        t.assert(body.data.length)
        var newLinkCount = 0
        body.data.forEach(function(stat) {
          newLinkCount += stat.value
        })
        t.assert(newLinkCount === oldLinkCount + 1)
        t.assert(body.data.some(function(stat) {
          return testUserId === stat._id._to
            && 'user' === stat._id.toSchema
            && 'like' === stat._id.type
        }))
        test.done()
      })
    })
  })
}

exports.statsPassThroughQueryCriteria = function(test) {
  t.get({
    uri: '/find/tos?query[_id._to]=' + testUserId + '&query[_id.type]=like'
  }, function(err, res, body) {
    t.assert(body.data.length)
    body.data.forEach(function(doc) {
      t.assert('like' === doc._id.type)
    })
    test.done()
  })
}


exports.statRefsDoNotPopulateForAnonUsers = function(test) {
  t.get({
    uri: '/find/tos?query[_id._to]=' + testUserId + '&refs=true'
  }, function(err, res, body) {
    t.assert(body.data[0]._id._to)
    t.assert(!body.data[0]._id.to)
    test.done()
  })
}

exports.statsCountToPlacesFromMessages = function(test) {
  t.post({
    uri: '/stats/to',
    body: {
      query: {
        '_id.day': {$lt: '130315'},
        '_id.toSchema': 'place',
        '_id.fromSchema': 'message',
      },
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.schema)
      t.assert(doc.category)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}

exports.statsCountToPlacesTypeWatch = function(test) {
  t.get({
    uri: '/stats/to?query[_id.toSchema]=place&query[_id.type]=like',
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

exports.statsCountCreatedLinksFromUsers = function(test) {
  t.get({
    uri: '/stats/from?query[_id.fromSchema]=user&query[_id.type]=create',
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

exports.statsCountPlacesByTunings = function(test) {
  t.get({
    uri: '/stats/from?query[_id.fromSchema]=place&query[_id.type]=proximity',
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

exports.adminCanRebuildTos = function(test) {
  t.get({
    uri: '/stats/to/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.cmd)
    t.assert(body.data.results)
    test.done()
  })
}

exports.adminCanRebuildFroms = function(test) {
  t.get({
    uri: '/stats/from/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.cmd)
    t.assert(body.data.results)
    test.done()
  })
}

exports.adminCanRebuildAll = function(test) {
  t.get({
    uri: '/stats/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.to)
    t.assert(body.data.to.cmd)
    t.assert(body.data.to.results)
    t.assert(body.data.from)
    t.assert(body.data.from.cmd)
    t.assert(body.data.from.results)
    test.done()
  })
}
