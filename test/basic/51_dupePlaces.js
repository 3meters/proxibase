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

var luckyStrikeIdFactual = '46ba739c-21f7-4d72-a544-5581c1d7a7a1'
var luckyStrikeFactual = {}

var luckyStrikeSplace = {}


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


exports.getPlacesNearLocationFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'factual',
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
      if (luckyStrikeIdFactual === place.provider.factual) {
        luckyStrikeFactual = place
        foundLuckyStrike++
      }
    })
    t.assert(1 === foundLuckyStrike)
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
    function(err, res, body) {
      t.assert(body && body.data && body.data.length)
      luckyStrikeSplace = body.data[0]
      t.assert(luckyStrikeSplace.entities && luckyStrikeSplace.entities.length)
      t.assert(luckyStrikeSplace.linksIn && luckyStrikeSplace.linksIn.length)
      t.assert(luckyStrikeSplace.entities.length === luckyStrikeSplace.linksIn.length)
      test.done()
    }
  )
}

exports.insertPlaceEntityAgain = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
    insertApplinks: true,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(body && body.data && body.data.length)
      var newPlace = body.data[0]
      t.assert(luckyStrikeSplace._id === newPlace._id)  // proves merge on provider.provider worked
      t.assert(luckyStrikeSplace.entities.length === newPlace.entities.length)  // proves applinks were not duped
      newPlace.entities.forEach(function(applink) {
        t.assert(applink.modifiedDate > luckyStrikeSplace.modifiedDate)  // proves applinks were updated
      })
      t.assert(luckyStrikeSplace.linksIn.length === body.data[0].linksIn.length)  // proves link records were not duped
      test.done()
    }
  )
}

exports.insertDupePlaceEntityFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrikeFactual,
    insertApplinks: true,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(body && body.data && body.data.length)
      var splace = body.data[0]
      t.assert(luckyStrikeSplace._id === splace._id)  // proves merge on phone number + !provider match worked
      t.assert(splace.provider)
      t.assert(luckyStrikeId === splace.provider.foursquare)
      t.assert(luckyStrikeIdFactual === splace.provider.factual)  // proves merged provider.provider
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

