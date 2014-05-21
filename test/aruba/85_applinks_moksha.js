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
      insertApplinks: false,
      testThumbnails: false,
      log: true,
      timeout: 20000,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    moksha._id = body.data._id
    test.done()
  })
}

exports.getMokshaApplinks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get?' + userCred,
    body: {
      placeId: moksha._id,
      waitForContent: true,
      testThumbnails: false,
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
    t.assert(1 === applinkMap.email, applinkMap)
    t.assert(1 === applinkMap.twitter, applinkMap)
    test.done()
  })
}


exports.cleanupPlace = function(test) {
  if (disconnected) return skip(test)
  t.delete({uri: '/data/places/' + moksha._id + '?' + adminCred}, function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}
