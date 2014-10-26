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

var vashonLoc = {
  lat: 47.5097,
  lng: -122.463998,
}

var savedRoxy  // shared between tests

// Seattle Ballroom
var ballRoomId = ''
var ballRoom4sId = '4abebc45f964a520a18f20e3'
var ballRoomYelpId = 'the-ballroom-seattle'
var ballRoomGoogleId = 'f0147a535bedf4bb948f35379873cab0747ba9e2'

// Cafe Ladro
var ladroId = '45d62041f964a520d2421fe3'

// Roxys Diner
var roxyId = ''
var roxyFoursquareId = '49cd242ef964a520bf591fe3'
var roxyGoogleId = 'd9083f5df362b2ed27c9e10339c9510960192624'
var roxyYelpId = 'roxys-diner-seattle'

// Kaosamai Thai
var ksthaiId = '4a3d9c80f964a52088a21fe3'

// Washington State Ferries
var washingtonStateFerriesId = ''
var washingtonStateFerriesGoogleId = '9113ade598b83b25cfb0fa34e8e3c9cd75cd2586'

// Vashon Ferry Terminal
var vashonFerryTerminalId = ''
var vashonFerryTerminalFoursquareId = '4ab6b690f964a520b07820e3'

// La Playa Mexican Restaurant
var laPlayaId = ''
var laPlayaFoursquareId = '4ace9457f964a5204bd120e3'
var laPlayaGoogleId = '0ff514498e53249ed817b88835248f620fd27112'
var laPlayaYelpId = 'laplaya-mexican-restaurant-vashon'

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

exports.getPlacesNearLocationUsingLimit = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      includeRaw: false,
      limit: 40,
      refresh: true,
      log: true,
      timeout: 15000,
    }
  }, function(err, res, body) {
    var foundBallroom = 0
    var foundRoxy = 0
    var places = body.data
    t.assert(places.length === 40)
    placeCount = {
      aircandi: 0,
      foursquare: 0,
      google: 0,
      yelp: 0
    }
    var lastDistance = 0
    places.forEach(function(place) {
      /*
      place.provider.google = place.provider.google || ''
      log(place.name + ' yelp: ' +  place.provider.yelp +
        ' google: ' + place.provider.google.slice(0,8) + ' 4s: ' + place.provider.foursquare)
      */
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
        t.assert(place.provider.yelp, place)
        // t.assert(place.provider.google, place)
        t.assert(place.provider.foursquare, place)
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
      t.assert(place.location.accuracy)
    })
    t.assert(placeCount.foursquare, placeCount)
    t.assert(placeCount.yelp, placeCount)
    t.assert(placeCount.google, placeCount)
    t.assert(foundBallroom === 1, {foundBallroom: foundBallroom})
    t.assert(foundRoxy === 1, {foundRoxy: foundRoxy})
    test.done()
  })
}

exports.getPlacesNearLocationUsingLimitAgain = function(test) {
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
      refresh: true,
      log: true,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 20)

    // Make sure ballroom was excluded
    places.forEach(function(place) {
      t.assert(place.provider, place)
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
    t.assert(roxys[0].photo)
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
      t.assert(Object.keys(savedRoxy.photo).length === 2)  // non-set properties removed
      t.assert(savedRoxy.name === roxy.name)  // change ignored
      t.assert(savedRoxy.provider.yelp === roxy.provider.yelp)

      t.post({
        uri: '/places/near',
        body: {
          location: ballRoomLoc,
          radius: 200,
          limit: 20,
          includeRaw: false,
          refresh: true,
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

exports.getPlacesNearLocationUsingRadius = function(test) {
  // Should take less than 5 seconds but using 10 second timeout anyway.
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      provider: 'foursquare|google|yelp',
      location: vashonLoc,
      radius: 1609,         // one mile
      includeRaw: true,
      limit: 50,
      log: true,
      timeout: 10000,
    }
  }, function(err, res, body) {
    var foundWashingtonStateFerries = 0
    var foundLaPlaya = 0
    t.assert(body.time > 1)       // Should take more than 1 second
    t.assert(body.time < 10)      // Should take less than 10 seconds
    var places = body.data
    t.assert(places.length === 2)
    places.forEach(function(place) {
      // Vashon ferry terminal
      if (place.provider.google === washingtonStateFerriesGoogleId) {
        foundWashingtonStateFerries++
        washingtonStateFerriesId = place._id
      }
      // La Playa
      if (place.provider.foursquare === laPlayaFoursquareId
          || place.provider.google === laPlayaGoogleId
          || place.provider.yelp === laPlayaYelpId) {
        foundLaPlaya++
        laPlayaId = place._id
      }
    })
    t.assert(foundWashingtonStateFerries === 1, {foundWashingtonStateFerries: foundWashingtonStateFerries})
    t.assert(foundLaPlaya === 1, {foundLaPlaya: foundLaPlaya})
    test.done()
  })
}


exports.getPlacesNearLocationUsingRadiusAgain = function(test) {
  // Make sure we get the same results and we get them fast (don't query partners again)
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      provider: 'foursquare|google|yelp',
      location: vashonLoc,
      radius: 1609,         // one mile
      includeRaw: false,
      limit: 50,
      log: true,
      timeout: 10000,
    }
  }, function(err, res, body) {
    var foundWashingtonStateFerries = 0
    var foundLaPlaya = 0
    t.assert(body.time < 1)       // More than 1 second means a partner query
    var places = body.data
    t.assert(places.length === 2)
    placeCount = {
      aircandi: 0,
      foursquare: 0,
      google: 0,
      yelp: 0
    }
    places.forEach(function(place) {
      var adminId = util.adminId
      t.assert(place.location)
      t.assert(place.provider)
      t.assert(adminId = place._owner)
      t.assert(adminId = place._creator)
      t.assert(adminId = place._modifier)
      for (var p in place.provider) {
        placeCount[p]++
      }
      // Vashon ferry terminal
      if (place.provider.google === washingtonStateFerriesGoogleId) {
        foundWashingtonStateFerries++
        washingtonStateFerriesId = place._id
      }
      // La Playa
      if (place.provider.foursquare === laPlayaFoursquareId
          || place.provider.google === laPlayaGoogleId
          || place.provider.yelp === laPlayaYelpId) {
        foundLaPlaya++
        laPlayaId = place._id
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
      t.assert(place.location.accuracy)
    })
    t.assert(foundWashingtonStateFerries === 1, {foundWashingtonStateFerries: foundWashingtonStateFerries})
    t.assert(foundLaPlaya === 1, {foundLaPlaya: foundLaPlaya})
    test.done()
  })
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

exports.findAndMergeDupes = function(test) {
  if (disconnected) return skip(test)
  t.get('/find/dupes?' + adminCred, function(err, res, body) {
    log('Dupe count:', body.count)
    t.assert(body.count)
    var revel, quoin
    body.data.forEach(function(dupeLog) {
      if (dupeLog.namelc === 'quoin' || dupeLog.namelc === 'revel') {
        if (dupeLog.data && dupeLog.data.dupes)
        dupeLog.data.dupes.forEach(function(dupe) {
          if (dupe.namelc === 'quoin') quoin = dupe
          if (dupe.namelc === 'revel') revel = dupe
        })
      }
    })
    t.assert(revel)
    t.assert(quoin)
    var rand = String(Math.floor(Math.random() * 1000000))
    var testMsgId = 'me.testMsg.' + rand
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body:  {
        entity: {
          _id: testMsgId,
          schema : 'message',
          name : "Test message to Quion",
        },
        links: [{
          _to: quoin._id,
          type: 'content',
        }],
        returnNotifications: true,
        activityDateWindow: 0,
      }
    }, 201, function(err, res, body) {
      t.get('/places/' + revel._id + '/merge/' + quoin._id + '?' + adminCred,
      function(err, res, body) {
        t.assert(body._place1Id)
        t.assert(body._place2Id)
        t.assert(body.place1Merged)
        t.assert(body.finished)
        t.get('/places/' + quoin._id,
        function(err, res, body) {
          t.assert(body.count === 0)
          t.assert(body.data === null)
          t.get('/find/links/count?query[_to]=' + quoin._id + '&' + adminCred,
          function(err, res, body) {
            // all links to quoin should be removed
            t.assert(body.count === 0)

            t.get('/find/links?query[_to]=' + revel._id + '&' + adminCred,
            function(req, res, body) {
              t.assert(body.data.length)
              var cCreate = 0
              var cContent = 0
              body.data.forEach(function(link) {
                if (link.type === 'create') cCreate++
                if (link.type === 'content') cContent++
              })
              t.assert(cCreate <= 1)
              t.assert(cContent === 1)
              // Make sure the message place was fixed up too
              t.get('/find/messages/' + testMsgId + '?' + adminCred,
              function(err, res, body) {
                t.assert(body.data)
                t.assert(body.data._acl = revel._id)
                test.done()
              })
            })
          })
        })
      })
    })
  })
}
