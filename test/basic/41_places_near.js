/**
 *  Proxibase place provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random
 *     web pages and services existing on the web.  Fine to move out of basic
 *     once the feature area is stable.
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
var admin
var userCred
var adminCred
var testEntity = {
  schema : util.statics.schemaPlace,
  name : "Test Place Entity Suggest Applinks",
  photo: {
    prefix: "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source: "aircandi",
  },
  signalFence : -100,
  enabled : true,
  locked : false,
}
var _exports = {} // for commenting out tests

var ballRoomLoc = {
  lat: 47.652084,
  lng: -122.353025,
}

var savedRoxy  // shared between tests

// Seattle Ballroom
var ballRoomId = ''
var ballRoom4sId = '4abebc45f964a520a18f20e3'
var ballRoomYelpId = 'the-ballroom-seattle'
var ballRoomGoogleId = 'f0147a535bedf4bb948f35379873cab0747ba9e2|aGoogleRef'

// Cafe Ladro
var ladroId = '45d62041f964a520d2421fe3'

// Roxys Diner
var roxyId = ''
var roxyFoursquareId = '49cd242ef964a520bf591fe3'
var roxyGoogleId = 'd9083f5df362b2ed27c9e10339c9510960192624'
var roxyYelpId = 'roxys-diner-seattle'

// Kaosamai Thai
var ksthaiId = '4a3d9c80f964a52088a21fe3'

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

exports.getCategories = function(test) {
  t.get({uri: '/places/categories'}, function(err, res) {
    var cats = res.body.data
    t.assert(cats.length === 12)
    test.done()
  })
}

exports.getPlacesNearLocation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      includeRaw: false,
      limit: 20,
      waitForContent: true,
      sort: 'distance',
      log: false,
      timeout: 15000,
    }
  }, function(err, res, body) {
    var foundBallroom = 0
    var foundRoxy = 0
    var places = body.data
    t.assert(places.length === 20)
    placeCount = {
      aircandi: 0,
      foursquare: 0,
      google: 0,
      yelp: 0
    }
    var lastDistance = 0
    places.forEach(function(place) {
      t.assert(place.location)
      // places should be sorted by distance from original location, close enough is ok
      var distance = util.haversine(ballRoomLoc.lat, ballRoomLoc.lng, place.location.lat, place.location.lng)
      t.assert((distance >= lastDistance || ((distance - lastDistance) < lastDistance / 2)),
          {distance: distance, lastDistance: lastDistance, place: place})
      lastDistance = distance
      t.assert(place.provider)
      var adminId = util.adminId
      t.assert(adminId = place._owner)
      t.assert(adminId = place._creator)
      t.assert(adminId = place._modifier)
      for (var p in place.provider) {
        placeCount[p]++
      }
      if (place.provider.google) place.provider.google = place.provider.google.split('|')[0]
      if (place.provider.foursquare === ballRoom4sId
          || place.provider.google === ballRoomGoogleId
          || place.provider.yelp === ballRoomYelpId) {
        foundBallroom++
        ballRoomId = place._id
      }
      if (place.provider.foursquare === roxyFoursquareId
          || place.provider.google === roxyGoogleId
          || place.provider.yelp === roxyYelpId) {
        foundRoxy++
        roxyId = place._id
      }
      var cat = place.category
      t.assert(cat, place)
      t.assert(cat.id)
      t.assert(cat.name)
      t.assert(cat.photo)
      var iconFileName = path.join(util.statics.assetsDir, '/img/categories', cat.photo.prefix + '88' + cat.photo.suffix)
      t.assert(fs.existsSync(iconFileName))
      t.assert(place.location)
      t.assert(place.location.lat)
      t.assert(place.location.lng)
      // If we have location accuracy, assert yelp is our only provider
      if (place.location.accuracy) {
        t.assert(place.provider.yelp, place)
        t.assert(!place.provider.google, place)
        t.assert(!place.provider.foursquare, place)
      }
      // If yelp is our only provider, assert we have location accuracy
      if (place.provider.yelp && !place.provider.google && !place.provider.foursquare) {
        t.assert(place.location, place)
        t.assert(place.location.accuracy, place)
      }
    })
    t.assert(foundBallroom === 1, {foundBallroom: foundBallroom})
    t.assert(foundRoxy === 1, {foundRoxy: foundRoxy})
    test.done()
  })
}

exports.getPlacesNearLocationAgain = function(test) {
  if (disconnected) return skip(test)
  var foundRoxy = false
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      excludePlaceIds: [ballRoomId], // The Ballroom's proxibase _id
      radius: 200,
      limit: 20,
      includeRaw: false,
      waitForContent: true,
      log: false,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 20)

    // Make sure ballroom was excluded
    places.forEach(function(place) {
      t.assert(place.provider, place)

      if (place.provider.google) place.provider.google = place.provider.google.split('|')[0]
      t.assert(place._id !== ballRoom4sId)
      t.assert(place.provider.foursquare !== ballRoom4sId)
      t.assert(place.provider.google !== ballRoomGoogleId)
      t.assert(place.provider.yelp !== ballRoomYelpId)

    })

    var roxys = places.filter(function(place) {
      return (place.name.match(/^Roxy/))
    })
    t.assert(roxys.length === 1)
    t.assert(roxys[0].name)
    log('Roxy photo comes and goes')
    // t.assert(roxys[0].photo)
    insertEnt(roxys[0])
  })

  // Edit roxy's diner
  function insertEnt(roxy) {
    delete roxy.creator
    delete roxy.owner
    delete roxy.modifier
    var myRoxy = util.clone(roxy)
    myRoxy.name = 'Changed Roxy'
    myRoxy.photo = {prefix: 'myNewPhoto.jpeg'}
    t.post({
      uri: '/do/updateEntity?' + userCred,
      body: {
        entity: myRoxy,
      }
    }, function(err, res, body) {
      t.assert(body.data)
      savedRoxy = res.body.data
      t.assert(savedRoxy.photo && savedRoxy.photo.prefix === myRoxy.photo.prefix) // change accepted
      log('photo properties not being nulled')
      // t.assert(Object.keys(savedRoxy.photo).length === 2)  // non-set properties removed
      t.assert(savedRoxy.name === roxy.name)  // change ignored
      t.assert(savedRoxy.provider.yelp === roxy.provider.yelp)

      t.post({
        uri: '/places/near',
        body: {
          location: ballRoomLoc,
          radius: 200,
          limit: 20,
          includeRaw: false,
          waitForContent: true,
          log: false,
        }
      }, function(err, res) {
        var places = res.body.data
        t.assert(places.length === 20)
        var roxys = places.filter(function(place) {
          return (roxyId === place._id)
        })
        t.assert(roxys.length === 1)
        t.assert(roxys[0].photo)
        t.assert(roxys[0].photo.prefix === myRoxy.photo.prefix, roxys[0]) // was not overridden by places near
        test.done()
      })
    })
  }
}

exports.getPlacePhotos = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/photos',
    body: {
      provider: 'foursquare',
      id: ballRoom4sId,
    }
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}

