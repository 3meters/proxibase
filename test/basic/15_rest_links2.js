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
var loc = {
  lat: 47,
  lng: -122,
  radians: 1000 / 6378137  // radius of the earth in meters
}

var cUsersWatched = 0
var cUsers = 0

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

exports.placesWithMessages = function(test) {
  t.post({
    uri: '/find/places?' + adminCred,
    body: {
      query: {
        'location.geometry': {
          $within: {$centerSphere: [[loc.lng, loc.lat], loc.radians]}
        },
      },
      links: {
        from: 'messages',
        count: true,
      }
    }
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data.length)
    test.done()
  })
}


_exports.usersWatched = function(test) {
  t.post({
    uri: '/find/users?' + adminCred,
    body: {
      links: {
        from: 'users',
        linkFilter: {type: 'watch'},
        count: true,
        outer: false,
      }
    }
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data.length)
    cUsersWatched = body.data.length
    test.done()
  })
}

_exports.usersWatchedOuter = function(test) {
  t.post({
    uri: '/find/users?' + adminCred,
    body: {
      links: {
        from: 'users',
        linkFilter: {type: 'watch'},
        count: true,
        outer: true,  // means include people that don't have any likes
      }
    }
  }, function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data.length)
    cUsers = body.data.length
    if (cUsersWatched < 50) {
      t.assert(cUsersWatched < cUsers)
    }
    test.done()
  })
}
