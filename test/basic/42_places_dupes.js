/**
 *  Proxibase duplicate place provider tests
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

var luckyStrikeLoc = {
  lat: 47.616658,
  lng: -122.201373,
}

var luckyStrikeId = '4a0df0d8f964a520b1751fe3'
var powerPlayId = '4bc0ffe974a9a5934423d1f6'
var luckyStrike = {}
var powerPlay = {}
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

exports.dupePlaceMaggiano = function(test) {

  if (disconnected) return skip(test)

  var locMag = {
    lat : 47.617132,
    lng : -122.200517,
  }
  t.post({
    uri: '/data/places?' + adminCred,  // users can only update selected properties
    body: {
      data: {
        name: "Maggiano's Little Italy",
        location: locMag,
        phone: '4255196476',
        provider: {foursquare: '43976c82f964a520a52b1fe3'},
      },
    }
  }, 201, function(err, res, body) {
    var place = body.data
    t.assert(place && place._id)
    t.post({
      uri: '/places/near',
      body: {
        location: locMag,
        radius: 500,
        includeRaw: false,
        waitForContent: true,
        limit: 50,
        timeout: 15000,
      }
    }, function(err, res, body) {
      var cMaggiano = 0
      body.data.forEach(function(place){
        if (0 === place.name.indexOf('Magg')) cMaggiano++
      })
      t.assert(1 === cMaggiano, cMaggiano)
      test.done()
    })
  })
}

exports.dupePlacesMergeOnPhoneNumberIfProvidersAreDifferent = function(test) {

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
        name: 'Zoka1',
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
    placeId = body.data._id
    t.post({
      uri: '/do/insertEntity?' + adminCred,
      body: {
        entity: {
          name: 'Zoka2',
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
      var place = body.data
      t.assert(placeId === place._id) // proves merged on phone number
      t.assert(place.provider.foursquare === '41b3a100f964a520681e1fe3' )
      t.assert(place.provider.yelp === 'zoka-coffee-roaster-and-tea-company-seattle-2')
      t.assert('Zoka1' === place.name) // prefer name from foursquare
      t.assert('yelpAddress' === place.address) // address last writer wins
      t.get('/places/near?location[lat]=47.668781&location[lng]=-122.332883&waitForContent=1',
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


exports.getPlacesNearLocation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      waitForContent: true,
      limit: 40,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeId === place.provider.foursquare) {
        luckyStrike = place
        delete luckyStrike.creator
        delete luckyStrike.owner
        delete luckyStrike.modifier
        foundLuckyStrike++
        t.assert(foundLuckyStrike <= 1, place)
      }
      if (powerPlayId === place.provider.foursquare) {
        powerPlay = place
        foundPowerPlay++
        t.assert(foundPowerPlay <= 1, place)
      }
    })
    t.assert(1 === foundLuckyStrike, foundLuckyStrike)
    t.assert(1 === foundPowerPlay, foundPowerPlay)
    test.done()
  })
}


exports.insertPlaceEntity = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
  function(err, res, body) {
    t.assert(body && body.data)
    luckyStrikeSplace = body.data
    test.done()
  })
}

exports.insertPlaceEntityAgain = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
  function(err, res, body) {
    t.assert(body && body.data)
    var newPlace = body.data
    t.assert(luckyStrikeSplace._id === newPlace._id)  // proves merge on provider.provider worked
    test.done()
  })
}

exports.cleanup = function(test) {
  t.delete({ uri: '/data/places/' + luckyStrike._id + '?' + adminCred},
  function(err, res, body) {
    t.assert(body.count === 1)
    t.delete({ uri: '/data/places/' + powerPlay._id + '?' + adminCred},
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}

exports.getDups = function(test) {
  if (disconnected) return skip(test)
  t.get('/find/dupes/count?' + adminCred, function(err, res, body) {
    t.assert(body.count)
    test.done()
  })
}
