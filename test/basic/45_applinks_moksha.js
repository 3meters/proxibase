/**
 *  Proxibase place provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random
 *     web pages and services existing on the web.  Fine to move out of basic
 *     once the feature area is stable.
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

var mokshaId = '505d321ee4b05434c0cfdbbd'
var moksha = {
  name: 'Moksha',
  schema: 'place',
  provider: {foursquare: mokshaId},
  location: {lng: -122.20160473223153, lat: 47.61652922796693},
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


exports.insertMoksha = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: moksha,
      insertApplinks: true,
      testThumbnails: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    moksha._id = body.data._id
    setTimeout(function() {test.done()}, 3000)
  })
}

exports.getMokshaApplinks = function(test) {
  t.post({
    uri: '/applinks/get?' + userCred,
    body: {
      placeId: moksha._id,
      waitForContent: true,
      testThumbnails: true,
      forceRefresh: true,
      includeRaw: true,
      log: true,
      timeout: 20000,
    }
  }, function(err, res, body) {
    applinks = body.data
    t.assert(applinks.some(function(applink) {
      return ('website' === applink.type)
    }))
    test.done()
  })
}


// return the db to a clean state.  twould be nice if the test harness did
// this automatically between test files.
exports.cleanupApplinks = function(test) {

  async.eachSeries(applinks, removeApplink, function(err) {
    t.assert(!err)
    test.done()
  })

  function removeApplink(applink, next) {
    t.assert(applink._id)
    t.get('/data/links?query[_from]=' + applink._id + '&query[_to]=' + moksha._id,
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
  t.delete({uri: '/data/places/' + moksha._id + '?' + adminCred}, function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}
