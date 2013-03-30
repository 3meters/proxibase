/*
 *  Proxibase external service provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random 
 *     web pages and services existing on the web.  Fine to move out of basic once
 *     feature area is stable.
 */

var util = require('proxutils')
var _ = util._
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var userCred
var adminCred
var testLatitude = 46.1
var testLongitude = -121.1
var testEntity = {
      photo: {
        prefix: "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
        format: "binary",
        sourceName: "aircandi",
      },
      signalFence : -100,
      name : "Test Place Entity Suggest Sources",
      type : "com.aircandi.candi.place",
      place: {location:{lat:testLatitude, lng:testLongitude}},
      visibility : "public",
      isCollection: true,
      enabled : true,
      locked : false,
    }
var _exports = {} // for commenting out tests


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.getCategories = function(test) {
  t.get({uri: '/categories'}, function(err, res) {
    var cats = res.body.data
    t.assert(cats && cats.length > 5)
    t.assert(cats[0].icon.length > 20)
    // TODO:  run a reqest on the icon and confirm that it is a valid png
    test.done()
  })
}

exports.getSources = function(test) {
  t.get({uri: '/sources'}, function(err, res) {
    var sources = res.body.data
    t.assert(sources && sources.length > 5)
    t.assert(sources[0].icon.length > 20)
    // TODO:  run a reqest on the icon and confirm that it is a valid png
    test.done()
  })
}

exports.getPlacesNearLocationFoursquare = function(test) {
  if (disconnected) return skip(test)
  var ballRoomId = '4abebc45f964a520a18f20e3'
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 10,
      excludePlaceIds: [ballRoomId], // The Ballroom's 4sId
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 9) // arguably a bug, the exclude process happens after the query
    places.forEach(function(place) {
      t.assert(place.place)
      t.assert(place.place.id)
      t.assert(place.place.id !== ballRoomId)
      t.assert(place.place.category)
      t.assert(place.place.category.name)
      var sources = place.sources
      t.assert(sources)
      t.assert(sources.length)
      sources.forEach(function(source) {
        t.assert(source.type)
        t.assert(source.id || source.url)
        t.assert(source.icon)
      })
    })
    test.done()
  })
}

exports.getPlacesNearLocationLargeRadius = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/do/getPlacesNearLocation?' + userCred,
    body: {
      provider: 'foursquare',
      //latitude: 47.6521,
      //longitude: -122.3530,
      latitude: 47.593,
      longitude: -122.159,
      radius: 10000,
      limit: 20,
    }
  }, function(err, res, body) {
    test.done()
  })
}

exports.getPlacesNearLocationFactual = function(test) {
  if (disconnected) return skip(test)
  var ballRoomId = '46aef19f-2990-43d5-a9e3-11b78060150c'
  var roxyId = '2bd21139-1907-4126-9443-65a2e48e1717' // Roxy's Diner 
  // var roxyId = 'fdf4b14d-93d7-4ada-8bef-19add2fa9b15'
  var foundRoxy = false
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'factual',
      radius: 500,
      limit: 10,
      excludePlaceIds: [ballRoomId],
      includeRaw: true,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 9)
    places.forEach(function(place) {
      t.assert(place.place)
      t.assert(ballRoomId !== place.place.id)
      t.assert(place.place.category, 'blech ' + util.inspect(place))
      t.assert(place.place.category.name)
    })
    var roxys = places.filter(function(e) {
      return (e.place.id === roxyId) // Roxy's Diner
    })
    t.assert(roxys.length === 1)
    insertEnt(roxys[0])
  })

  // Insert the roxy diner and make sure her sources come out right
  function insertEnt(roxy) {
    var ent = {
      signalFence : -100,
      name : roxy.name,
      type : "com.aircandi.candi.place",
      place: {location:{lat:roxy.place.location.lat, lng:roxy.place.location.lng}},
      sources: roxy.sources,
      visibility : "public",
      isCollection: true,
      enabled : true,
      locked : false,
    }
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: ent,
        suggestSources: true
      }
    }, 201, function(err, res) {
      t.assert(res.body.data.length)
      var sources = res.body.data[0].sources
      t.assert(sources && sources.length >= 2) // a website and a twitter account
      sources.forEach(function(source) {
        t.assert(source.type)
        if (source.type === 'factual') t.assert(source.system)
        t.assert(source.id || source.url)
        t.assert(source.icon)
        t.assert(source.data)
        t.assert(source.data.origin)
      })
      test.done()
    })
  }
}


exports.suggestSourcesFromWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/sources/suggest',
    body: {sources: [{type: 'website', id: 'http://www.massenamodern.com'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 2)
    t.assert(res.body.data[1].type === 'twitter')
    t.assert(res.body.data[1].id === 'massenamodern')
    test.done()
  })
}


exports.suggestFactualSourcesFromFoursquareId = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/sources/suggest',
    body: {sources: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]} // Seattle Ballroom in Fremont
  },
  function(err, res) {
    t.assert(res.body.data.length > 3)
    var source = res.body.data[0]
    t.assert(source.type === 'foursquare' && source.id === '4abebc45f964a520a18f20e3')
    test.done()
  })
}

exports.insertEntitySuggestSources = function(test) {
  if (disconnected) return skip(test)
  var body = {
    suggestSources: true,
    entity: util.clone(testEntity),
  }
  body.entity.sources = [{
    type: 'website',
    id: 'http://www.massenamodern.com'
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length === 2) // appends the new sources to the ones in the request
      t.assert(sources[1].type === 'twitter')
      t.assert(sources[1].id === 'massenamodern')
      test.done()
    }
  )
}

exports.insertPlaceEntitySuggestSourcesFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    suggestSources: true,
    entity: _.clone(testEntity),
  }
  body.entity.sources = [{
    type: 'foursquare',
    id: '4abebc45f964a520a18f20e3' // Seattle Ballroom
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length > 3) // appends the new sources to the ones in the request
      // TODO: check for specific source
      test.done()
    }
  )
}

exports.getPlacesInsertEntityGetPlaces = function(test) {
  if (disconnected) return skip(test)
  var ballRoomId = '4abebc45f964a520a18f20e3'
  // Cafe Ladro, a few doors down from the Ballroom
  var ladroId = '45d62041f964a520d2421fe3'
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'foursquare',
    }
  }, function(err, res, body) {
    var places = body.data
    var ladro = null
    t.assert(places.length > 10)
    places.forEach(function(place) {
      if (ladroId === place.place.id) {
        return ladro = place
      }
    })
    t.assert(ladro)
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {entity: ladro}
    }, 201, function(err, res, body) {
      t.post({
        uri: '/do/insertEntity?' + userCred,
        body: {entity: {
          name: 'A user-created Test Entity Inside the BallRoom',
          type : "com.aircandi.candi.place",
          place: {provider: 'user', location: {lat: 47.6521, lng: -122.3530}},
          visibility : "public",
          isCollection: true,
          enabled : true,
          locked : false,
        }}
      }, 201, function(err, res, body) {
        var newEnt = body.data[0]
        t.assert(newEnt)
        t.post({
          uri: '/do/insertEntity?' + userCred,
          body: {entity: {
            name: 'A user-created Entity At George\'s House',
            type : 'com.aircandi.candi.place',
            place: {provider: 'user', location: {lat: 47.664525, lng: -122.354787}},
            visibility : "public",
            isCollection: true,
            enabled : true,
            locked : false,
          }}
        }, 201, function(err, res, body) {
          var newEnt2 = body.data[0]
          t.assert(newEnt2)
          t.post({
            uri: '/do/getPlacesNearLocation',
            body: {
              latitude: 47.6521,
              longitude: -122.3530,
              provider: 'foursquare',
            }
          }, function(err, res, body) {
            // Make sure the real entitiy is in the found places
            var places = body.data
            var foundLadro = 0
            var foundNewEnt = 0
            var foundNewEnt2 = 0
            places.forEach(function(place) {
              if (place.place.id && place.place.id === ladroId) foundLadro++
              if (place._id && place._id === newEnt._id) foundNewEnt++
              if (place._id && place._id === newEnt2._id) foundNewEnt2++
            })
            t.assert(foundLadro === 1)
            t.assert(foundNewEnt === 1)
            t.assert(foundNewEnt2 === 0)
            // Make sure search by factual returns the same result, join is on phone number
            t.post({
              uri: '/do/getPlacesNearLocation',
              body: {
                latitude: 47.6521,
                longitude: -122.3530,
                provider: 'factual',
              }
            }, function(err, res, body) {
              var places = body.data
              var foundLadro = 0
              var foundNewEnt = 0
              var foundNewEnt2 = 0
              places.forEach(function(place) {
                if (place._id && place.place.id === ladroId) foundLadro++
                if (place._id && place._id === newEnt._id) foundNewEnt++
                if (place._id && place._id === newEnt2._id) foundNewEnt2++
              })
              t.assert(foundLadro === 1)
              t.assert(foundNewEnt === 1)
              t.assert(foundNewEnt2 === 0)
              // Confirm that excludePlaceIds works for our entities
              t.post({
                uri: '/do/getPlacesNearLocation',
                body: {
                  latitude: 47.6521,
                  longitude: -122.3530,
                  provider: 'foursquare',
                  excludePlaceIds: [newEnt._id],
                }
              }, function(err, res, body) {
                var places = body.data
                t.assert(!places.some(function(place) {
                  return (place._id === newEnt._id)
                }))
                test.done()
              })
            })
          })
        })
      })
    })
  })
}

exports.getPlacePhotos = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/do/getPlacePhotos',
    body: {provider: 'foursquare', id: '4abebc45f964a520a18f20e3'}
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}
