/**
 *  Proxibase more duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests

var westSeattle = {
  lat: 47.569,
  lng: -122.371,
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

exports.dupePlaceDuos = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/places/near',
    body: {
      location: westSeattle,
      refresh: true,
      limit: 50,
      timeout: 15000,
    }
  }, function(err, res, body) {
    var cDuos = 0
    body.data.forEach(function(place) {
      if (place.name.match(/Duos/)) {
        cDuos++
      }
    })
    t.assert(2 === cDuos, cDuos)
    test.done()
  })
}

exports.dupeManuallyMergesPlacesOnPhoneNumberWithDifferentProviders = function(test) {

  var zokaLoc = {
    lat: 47.668781,
    lng: -122.332883,
  }

  if (disconnected) return skip(test)

  placeId = ''
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: {
        name: 'ZokaYelp',
        schema: 'place',
        provider: {
          yelp: 'zoka-coffee-roaster-and-tea-company-seattle-2'
        },
        location: zokaLoc,
        address: 'yelpAddress',
        phone: '2065454277',
      },
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    placeId = body.data._id
    t.post({
      uri: '/do/insertEntity?' + adminCred,
      body: {
        entity: {
          name: 'ZokaFoursquare',
          schema: 'place',
          provider: {
            foursquare: '41b3a100f964a520681e1fe3',
          },
          location: zokaLoc,
          address: 'foursquareAddress',
          phone: '2065454277',
        },
      }
    }, 201, function(err, res, body) {
      t.assert(body.data)
      var place = body.data
      t.assert(placeId === place._id) // proves merged on phone number
      t.assert(place.provider.foursquare === '41b3a100f964a520681e1fe3' )
      t.assert(place.provider.yelp === 'zoka-coffee-roaster-and-tea-company-seattle-2')
      t.assert('foursquareAddress' === place.address) // address last writer wins
      t.get('/places/near?location[lat]=47.668781&location[lng]=-122.332883&refresh=1',
      function (err, res, body) {
        t.assert(body.data.length)
        var zokas = body.data.filter(function(place) {
          return place.name.match(/Zoka/i)
        })
        t.assert(zokas.length === 1)
        test.done()
      })
    })
  })
}


exports.nearLinconSquare = function(test) {
  if (disconnected) return skip(test)

  var linconSquareLoc = {
    lat: 47.616658,
    lng: -122.201373,
  }

  var luckyStrikefoursquareId = '4a0df0d8f964a520b1751fe3'
  var powerPlayfoursquareId = '4bc0ffe974a9a5934423d1f6'
  var luckyStrike = {}
  var powerPlay = {}
  var foundPlace = {}

  t.post({
    uri: '/places/near',
    body: {
      location: linconSquareLoc,
      radius: 500,
      includeRaw: false,
      refresh: true,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikefoursquareId === place.provider.foursquare) {
        luckyStrike = place
        foundLuckyStrike++
        t.assert(foundLuckyStrike <= 1, place)
      }
      if (powerPlayfoursquareId === place.provider.foursquare) {
        powerPlay = place
        foundPowerPlay++
        t.assert(foundPowerPlay <= 1, place)
      }
    })
    t.assert(1 === foundLuckyStrike + foundPowerPlay)  // We merged 2 foursquare places into one
    foundPlace = foundLuckyStrike ? luckyStrike : powerPlay
    t.assert(foundPlace.name.match(/^Lucky/))          // Prefer yelp name, Lucky Strike over Foursquare name
    test.done()
  })
}


exports.getDups = function(test) {
  if (disconnected) return skip(test)
  t.get('/find/dupes/count?' + adminCred, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}
