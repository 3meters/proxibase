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

var luckyStrikeId = '4a0df0d8f964a520b1751fe3'
var powerPlayId = '4bc0ffe974a9a5934423d1f6'
var luckyStrike = {}
var powerPlay = {}

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

exports.getPlacesNearLocation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeId === place.provider.foursquare) {
        luckyStrike = place
        foundLuckyStrike++
      }
      if (powerPlayId === place.provider.foursquare) {
        powerPlay = place
        foundPowerPlay++
      }
    })
    t.assert(1 === foundLuckyStrike)
    t.assert(1 === foundPowerPlay)
    test.done()
  })
}


exports.insertPlaceEntity = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
    insertApplinks: true,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      test.done()
    }
  )
}

exports.getPlacesNearLocationWithUpsizedPlace = function(test) {
 if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeId === place.provider.foursquare) {
        foundLuckyStrike++
        t.assert(place.name === luckyStrike.name)
      }
      if (powerPlayId === place.provider.foursquare) {
        foundPowerPlay++
        t.assert(place.name === powerPlay.name)
      }
    })
    t.assert(1 === foundLuckyStrike)
    t.assert(1 === foundPowerPlay)
    test.done()
  })
}
