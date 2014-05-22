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

var foursquareId = '40b13b00f964a52038f61ee3'
var googleId = '723b98d536bce94a1b5409d82e1444c2ea399469|CoQBcgAAAEsVgB6LDRqEi56Xgsr_BeZTyA7CFoteqjNCcVGPr50dKigXOGRfRO4yjjQUwRgKctHE6o-cymu9mzOT9hER6MbIbJ65pcX3lZgRnLjFKl9dhFDrANCCklUWW5Te4ocZ7eI-63EFs5_XaDU8qMtwDfsEOATOY74UUjrvUDb1L2vqEhCLexCY_6188gH5z6z1UnCDGhRS226-FJ0blzUXjUG7wngVBL6ndQ'

var bluemoon = {
  name: 'Bluemoon',
  schema: 'place',
  provider: {
    foursquare: foursquareId,
    google: googleId,
  },
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
      insertApplinks: false,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    bluemoon._id = body.data._id
    test.done()
  })
}


// Bluemoon puts links to the facebook pages of all its upcoming
// bands on its home page.  We dutifully find them all and their
// web pages too.
// Skipping for now since its not clear we can do anything about it,
// and it takes a very long time to run.
exports.getBluemoonApplinks = function(test) {
  return skip(test)
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get?' + userCred,
    body: {
      placeId: bluemoon._id,
      forceRefresh: true,
      includeRaw: true,
      log: true,
      timeout: 20000,
    }
  }, function(err, res, body) {
    applinks = body.data
    t.assert(applinks[0].appId === 'http://bluemoonseattle.wordpress.com')
    var applinkMap = {}
    applinks.forEach(function(link) {
      if (!applinkMap[link.type]) {
        applinkMap[link.type] = 1
      }
      else applinkMap[link.type]++
    })
    log('applinks:', applinkMap)
    t.assert(applinkMap.website >= 1, applinkMap)
    t.assert(applinkMap.facebook >= 1, applinkMap)
    t.assert(applinkMap.foursquare === 1, applinkMap)
    t.assert(!applinkMap.twitter, applinkMap)  // we dectect too many and so throw them all out
    test.done()
  })
}


exports.cleanupPlace = function(test) {
  if (disconnected) return skip(test)
  t.delete({uri: '/data/places/' + bluemoon._id + '?' + adminCred}, function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}
