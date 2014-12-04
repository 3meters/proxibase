/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var db = testUtil.db
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests



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

  var locMaggiano = {
    lat : 47.617132,
    lng : -122.200517,
  }
  t.post({
    uri: '/data/places?' + adminCred,  // users can only update selected properties
    body: {
      data: {
        name: "Maggiano's Little Italy",
        location: locMaggiano,
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
        location: locMaggiano,
        includeRaw: false,
        refresh: true,
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

exports.dupePlaceLuckyStrike = function(test) {

  if (disconnected) return skip(test)

  var luckyStrikeLoc = {
    lat: 47.616658,
    lng: -122.201373,
  }

  var luckyStrikeFoursquareId = '4a0df0d8f964a520b1751fe3'
  var powerPlayFoursquareId = '4bc0ffe974a9a5934423d1f6'
  var luckyStrike = {}
  var powerPlay = {}

  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
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
      if (luckyStrikeFoursquareId === place.provider.foursquare) {
        luckyStrike = place
        delete luckyStrike.creator
        delete luckyStrike.owner
        delete luckyStrike.modifier
        foundLuckyStrike++
        t.assert(foundLuckyStrike <= 1, place)
      }
      if (powerPlayFoursquareId === place.provider.foursquare) {
        powerPlay = place
        foundPowerPlay++
        t.assert(foundPowerPlay <= 1, place)
      }
    })
    t.assert(foundLuckyStrike + foundPowerPlay === 1, {luckyStrike: luckyStrike, powerPlay: powerPlay})

    foundPlace = foundLuckyStrike ? luckyStrike : powerPlay
    if (foundPlace.provider.yelp) t.assert(foundPlace.name.match(/^Lucky/))     // Prefer yelp name, Lucky Strike over Foursquare name

    var body = {
      entity: foundPlace
    }

    t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(body && body.data)
      var newPlace = body.data
      t.assert(foundPlace._id === newPlace._id)  // proves insertEntity upserted
      test.done()
    })
  })
}


_exports.cleanup = function(test) {
  if (disconnected) return skip(test)
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
    // t.assert(body.count)
    log('Dupe count:', body.count)
    test.done()
  })
}