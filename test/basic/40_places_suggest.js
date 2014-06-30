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

var LuckyStrikeId = ''
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
    uri: '/places/suggest?' + userCred,
    body: {
      provider: 'foursquare',
      location: luckyStrikeLoc,
      input: 'lucky',
      timeout: 15000,
      limit: 10,
      includeRaw: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length > 5)
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike')) hitCount++
    })
    t.assert(hitCount >= 1)
    test.done()
  })
}

exports.suggestPlacesGoogle = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/places/suggest?' + userCred,
    body: {
      provider: 'google',
      location: luckyStrikeLoc,
      input: 'lucky',
      sensor: true,
      limit: 10,
      log: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length <= 5) // 4 if lucky is in db and 5 otherwise
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike')) hitCount++
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


// Populate our db using a near query, then test our built-in suggest provider
// in following tests
exports.getPlacesNear = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/places/near?' + userCred,
    body: {
      location: luckyStrikeLoc,
      limit: 50,
      refresh: true,
      // radius: 500,
      // log: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(50 === places.length)

    var lastDistance = 0
    places.forEach(function(place) {
      t.assert(place.location)
      // places should be sorted by distance from original location, close enough is ok
      var distance = util.haversine(luckyStrikeLoc.lat, luckyStrikeLoc.lng,
        place.location.lat, place.location.lng)
      /*
      log(distance + ' ' + place.name + ' ' + Object.keys(place.provider).join(' ') +
        ' ' + place.location.lat + ' ' + place.location.lng + ' ' + place.location.accuracy)
      */
      if (place.location.accuracy < 100) {
        t.assert((distance >= lastDistance || ((distance - lastDistance) < lastDistance / 2)),
            {distance: distance, lastDistance: lastDistance, place: place})
        lastDistance = distance
      }
    })


    return test.done()
    t.assert(places.some(function(place) {
      luckyStrikeId = place._id
      return place.name.match(/^Lucky Strike/)
    }))
    test.done()
  })
}

exports.suggestPlaceAircandi1 = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/places/suggest?' + userCred,
    body: {
      location: luckyStrikeLoc,
      input: 'lucky',
      limit: 10,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length)
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike')) hitCount++
    })
    t.assert(hitCount === 1)
    test.done()
  })
}

