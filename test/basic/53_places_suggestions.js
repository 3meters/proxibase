/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests

var luckyStrikeLoc = {
  lat: 47.616658,
  lng: -122.201373,
}

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

/*
 * These tests confirm the core code path that returns places. If previous
 * tests in the path have upsized Lucky Strike Lanes into the db, then these
 * tests also assert that the duplicate from the suggest service has been
 * excluded.
 */
exports.suggestPlacesFoursquare = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/do/suggestPlaces?' + userCred,
    body: {
      provider: 'foursquare',
      location: luckyStrikeLoc,
      input: 'lucky',
      limit: 10,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length > 5)
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike Lanes')) hitCount++
    })
    t.assert(1 === hitCount)
    test.done()
  })
}

exports.suggestPlacesGoogle = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/do/suggestPlaces?' + userCred,
    body: {
      provider: 'google',
      location: luckyStrikeLoc,
      input: 'lucky',
      limit: 10,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length >= 4) // 4 if lucky is in db and 5 otherwise
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike Bellevue')) hitCount++
    })
    t.assert(1 === hitCount)
    test.done()
  })
}

/*
 * Additional test candidates:
 * - Verify that watched items are flagged and scored correctly if user is provided.
 * - Ensure Lucky is in db so duplicate logic is always exercised.
 * - Verify that all places have a reason and score.
 */
