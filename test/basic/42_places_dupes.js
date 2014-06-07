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


exports.findNearRepeatedlyDoesNotDupe = function(test) {

  var ll = '47.6016363,-122.331157'  // Pioneer Square

  if (disconnected) return skip(test)
  t.get('/places/near?ll=47.6016363,-122.331157&waitForContent=1&limit=50',
  function(err, res, body) {
    t.assert(body.data.length === 50)
    t.get('/places/near?ll=47.6016363,-122.331157&&waitForContent=1&limit=50',
    function(err, res, body) {
      t.assert(body.data.length === 50)
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

exports.dupeZokaMergesOnPhoneNumber = function(test) {

  if (disconnected) return skip(test)

  var zokaLoc = {
    lat: 47.668781,
    lng: -122.332883,
  }

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
    var zoka1 = body.data
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
      var zoka2 = body.data
      t.assert(zoka1._id === zoka2._id, {zoka1: zoka1, zoka2: zoka2}) // proves merged on phone number
      t.assert(zoka2.provider.foursquare === '41b3a100f964a520681e1fe3' )
      t.assert(zoka2.provider.yelp === 'zoka-coffee-roaster-and-tea-company-seattle-2')
      t.assert('Zoka2' === zoka2.name) // name last writer wins foursquare
      t.assert('yelpAddress' === zoka2.address) // address last writer wins
      t.get('/places/near?location[lat]=47.668781&location[lng]=-122.332883&waitForContent=1&refresh=1',
      function (err, res, body) {
        t.assert(body.data.length)
        var zokas = body.data.filter(function(place) {
          return place.name.match(/Zoka/i)
        })
        t.assert(zokas.length === 1, zokas)
        var nearZoka = zokas[0]
        t.assert(nearZoka.provider.foursquare, nearZoka)
        t.assert(nearZoka.provider.yelp, nearZoka)
        t.assert(nearZoka.provider.google, nearZoka)
        test.done()
      })
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
      waitForContent: true,
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
    t.assert(foundLuckyStrike + foundPowerPlay === 1)

    var entToUpsize = null
    if (foundLuckyStrike) entToUpsize = luckyStrike
    else entToUpsize = powerPlay

    t.assert(entToUpsize.name.match(/^Lucky/), entToUpsize)

    var body = {
      entity: entToUpsize
    }

    t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(body && body.data)
      var newPlace = body.data
      t.assert(entToUpsize._id === newPlace._id)  // proves insertEntity upserted
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


_exports.getDups = function(test) {
  if (disconnected) return skip(test)
  t.get('/find/dupes/count?' + adminCred, function(err, res, body) {
    t.assert(body.count)
    test.done()
  })
}
