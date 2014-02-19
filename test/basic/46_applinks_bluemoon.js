/**
 *  Proxibase applinks tests
 *
 */

var util = require('proxutils')
var async = require('async')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var admin
var userCred
var adminCred
var _exports = {}

var bluemoonId = '40b13b00f964a52038f61ee3'
var bluemoon = {
  name: 'Bluemoon',
  schema: 'place',
  provider: {foursquare: bluemoonId},
  location: {lat: 47.66138, lng: -122.320078},
}

var applinks = []

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      admin = {_id: session._owner}
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.insertBluemoon = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: bluemoon,
      insertApplinks: true,
      testThumbnails: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    bluemoon._id = body.data._id
    setTimeout(function() {test.done()}, 3000)
  })
}

exports.getBluemoonApplinks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get?' + userCred,
    body: {
      placeId: bluemoon._id,
      waitForContent: true,
      testThumbnails: true,
      forceRefresh: true,
      includeRaw: true,
      log: true,
      timeout: 20000,
    }
  }, function(err, res, body) {
    applinks = body.data
    var applinkMap = {}
    applinks.forEach(function(link) {
      if (!applinkMap[link.type]) {
        applinkMap[link.type] = 1
      }
      else applinkMap[link.type]++
    })
    t.assert(1 === applinkMap.website, applinkMap)
    t.assert(1 === applinkMap.facebook, applinkMap)
    t.assert(1 === applinkMap.foursquare, applinkMap)
    t.assert(1 === applinkMap.yelp, applinkMap)
    t.assert(1 === applinkMap.twitter, applinkMap)
    test.done()
  })
}


// return the db to a clean state.  twould be nice if the test harness did
// this automatically between test files.
exports.cleanupApplinks = function(test) {
  if (disconnected) return skip(test)

  async.eachSeries(applinks, removeApplink, function(err) {
    t.assert(!err)
    test.done()
  })

  function removeApplink(applink, next) {
    t.assert(applink._id)
    t.get('/data/links?query[_from]=' + applink._id + '&query[_to]=' + bluemoon._id,
    function(err, res, body) {
      t.assert(1 === body.data.length)
      t.delete({uri: '/data/links/' + body.data[0]._id + '?' + adminCred}, function(err, res, body) {
        t.assert(1 === body.count)
        t.delete({uri: '/data/applinks/' + applink._id + '?' + adminCred}, function(err, res, body) {
          t.assert(1 === body.count)
          next()
        })
      })
    })
  }
}

exports.cleanupPlace = function(test) {
  if (disconnected) return skip(test)
  t.delete({uri: '/data/places/' + bluemoon._id + '?' + adminCred}, function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}
