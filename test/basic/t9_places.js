/**
 *  Proxibase place provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random
 *     web pages and services existing on the web.  Fine to move out of basic
 *     once the feature area is stable.
 */

var util = require('proxutils')
var _ = util._
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var testLatitude = 46.1
var testLongitude = -121.1
var testEntity = {
      photo: {
        prefix: "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
        sourceName: "aircandi",
      },
      signalFence : -100,
      name : "Test Place Entity Suggest Sources",
      type : "com.aircandi.candi.place",
      place: {lat:testLatitude, lng:testLongitude},
      visibility : "public",
      isCollection: true,
      enabled : true,
      locked : false,
    }
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

exports.getCategories = function(test) {
  t.get({uri: '/places/getCategories'}, function(err, res) {
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
    uri: '/places/getNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 10,
    }
  }, function(err, res) {
    var foundBallroom = 0
    var places = res.body.data
    t.assert(places.length === 10)
    places.forEach(function(place) {
      t.assert(place.place.provider)
      if (place.place.provider.foursquare === ballRoomId) foundBallroom++
      t.assert(place.place.category)
      t.assert(place.place.category.name)
      t.assert(/^\/img\/categories\/foursquare\/.*_88\.png$/.test(place.place.category.icon))
      var sources = place.sources
      t.assert(sources)
      t.assert(sources.length)
      sources.forEach(function(source) {
        t.assert(source.type)
        t.assert(source.id || source.url)
        t.assert(!source.icon)
        if (source.type === 'twitter') {
          t.assert('com.twitter.android' === source.packageName )
        }
      })
    })
    t.assert(foundBallroom === 1)
    test.done()
  })
}

exports.getPlacesNearLocationExcludeWorks = function(test) {
  if (disconnected) return skip(test)
  var ballRoomId = '4abebc45f964a520a18f20e3'
  t.post({
    uri: '/places/getNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'foursquare',
      radius: 500,
      excludePlaceIds: [ballRoomId], // The Ballroom's 4sId
    }
  }, function(err, res) {
    var places = res.body.data
    places.forEach(function(place) {
      t.assert(place.place.id !== ballRoomId)
    })
    test.done()
  })
}

exports.getPlacesNearLocationLargeRadius = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/getNearLocation?' + userCred,
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
  var foundRoxy = false
  t.post({
    uri: '/places/getNearLocation',
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
    t.assert(places.length >= 8)
    places.forEach(function(place) {
      t.assert(place.place)
      t.assert(place.place.provider)
      t.assert(place.place.provider.factual)
      t.assert(ballRoomId !== place.place.provider.factual) //excluded
      t.assert(place.place.category)
      t.assert(place.place.category.name)
      t.assert(place.place.category.icon)
    })
    var roxys = places.filter(function(e) {
      return (e.place.provider.factual === roxyId) // Roxy's Diner
    })
    t.assert(roxys.length === 1)
    insertEnt(roxys[0])
  })

  // Insert the roxy diner and make sure her sources come out right
  function insertEnt(roxy) {
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: roxy,
        suggestSources: true,
        includeRaw: true,
      }
    }, 201, function(err, res) {
      t.assert(res.body.data.length)
      var savedRoxy = res.body.data[0]
      t.assert(savedRoxy.place.provider.factual === roxy.place.provider.factual)
      var sources = savedRoxy.sources
      t.assert(sources && sources.length >= 2) // a website and a twitter account
      sources.forEach(function(source) {
        t.assert(source.type)
        if (source.type === 'factual') t.assert(source.system)
        t.assert(source.id || source.url)
        t.assert(!source.icon)
        t.assert(source.data)
        t.assert(source.data.origin)
      })
      t.assert(sources.some(function(source) {
        return (source.type === 'foursquare'
            && source.photo
            && source.photo.prefix
            && source.photo.suffix
          )
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'facebook')
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'factual'
            && source.system
          )
      }))
      test.done()
    })
  }
}

exports.getPlacesNearLocationGoogle = function(test) {
  if (disconnected) return skip(test)

  var ballRoomId = 'f0147a535bedf4bb948f35379873cab0747ba9e2'
  var roxyId = 'd9083f5df362b2ed27c9e10339c9510960192624'

  var foundRoxy = 0
  var googleProvided = 0
  var factualProvided = 0
  t.post({
    uri: '/places/getNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'google',
      radius: 100,
      limit: 10,
      excludePlaceIds: [ballRoomId],
      includeRaw: false,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length >= 8)
    places.forEach(function(place) {
      t.assert(place.place)
      t.assert(place.place.provider)
      if (place.place.provider.google) {
        googleProvided++
        t.assert(place.place.provider.googleReference, place.place)
        t.assert(place.sources.some(function(source) {
          return (source.type === 'google')
        }), place.sources)
      }
      if (place.place.provider.factual) {
        factualProvided++
      }
      // Not all places returned need to have place.place.provider.google
      // They can be entities we already have in our system given by
      // foursquare, factual, or user
      t.assert(ballRoomId !== place.place.provider.google) //excluded
      t.assert(place.place.lat)
      t.assert(place.place.lng)
      if (roxyId === place.place.provider.google) {
        foundRoxy++
        t.assert(place.place.address)
        t.assert(place.place.city)
        t.assert(place.place.state)
        t.assert(place.place.cc, place.place)
        t.assert(place.place.postalCode)
        t.assert(place.sources.some(function(source) {
          return (source.type === 'website')
        }))
      }
      t.assert(place.place.category)
      t.assert(place.place.category.name)
      t.assert(place.place.category.icon)
    })
    t.assert(1 === foundRoxy)
    t.assert(googleProvided)
    t.assert(factualProvided) // proves dupe merging on phone works
    test.done()
  })
}


exports.insertEntitySuggestSources = function(test) {
  if (disconnected) return skip(test)
  var body = {
    suggestSources: true,
    entity: util.clone(testEntity),
    includeRaw: true,
  }
  body.entity.sources = [{
    type: 'website',
    id: 'http://www.massenamodern.com'
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length === 2)
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
    id: '4abebc45f964a520a18f20e3'  // Seattle Ballroom
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length > 3) 
      t.assert(sources.some(function(source) {
        return (source.type === 'foursquare'
            && source.id === '4abebc45f964a520a18f20e3'
          )
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'facebook')
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'website')
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'factual')
      }))
      t.assert(sources.some(function(source) {
        return (source.type === 'twitter')
      }))
      test.done()
    }
  )
}

// Big test that replicates the full round trip from
// get places through create entity mixing in custom
// entities and multiple place providers. Subject to
// breaks if the providers change data or are
// unavailable.
exports.getPlacesInsertEntityGetPlaces = function(test) {

  if (disconnected) return skip(test)
  var ballRoomId = '4abebc45f964a520a18f20e3' // Ball Room, Fremont Seattle
  var ladroId = '45d62041f964a520d2421fe3'    // Cafe Ladro, a few doors down

  // Fire up radar from the Ball Room
  t.post({
    uri: '/places/getNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,
      provider: 'foursquare',
    }
  }, function(err, res, body) {
    var places = body.data
    var ladro = null
    var hasFactualProviderId = 0
    t.assert(places.length > 10)
    places.forEach(function(place) {
      t.assert(place.place.provider)
      if (place.place.provider.factual) {
        hasFactualProviderId++
        t.assert(place.place.provider.foursquare) // we merged them
      }
      if (ladroId === place.place.provider.foursquare) {
        ladro = place
      }
    })
    t.assert(ladro)

    // We added a Roxy entity above, sourced from factual.
    // This proves we have merged multiple provider ids onto
    // single entity
    t.assert(hasFactualProviderId)

    // Insert ladro as an entity
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {entity: ladro, suggestSources: true, includeRaw: true}
    }, 201, function(err, res, body) {
      t.assert(body.data[0].sources)
      var sources = body.data[0].sources
      var srcMap = {}
      sources.forEach(function(source) {
        srcMap[source.type] = srcMap[source.type] || 0
        srcMap[source.type]++
      })
      t.assert(srcMap.factual === 1)
      t.assert(srcMap.website === 1)
      t.assert(srcMap.foursquare === 1)
      t.assert(srcMap.facebook >= 1)
      t.assert(srcMap.twitter >= 1)

      // Add a user-created place inside the ballroom
      t.post({
        uri: '/do/insertEntity?' + userCred,
        body: {entity: {
          name: 'A user-created Test Entity Inside the BallRoom',
          type : "com.aircandi.candi.place",
          place: {provider: {user: user._id}, lat: 47.6521, lng: -122.3530},
          visibility : "public",
          isCollection: true,
          enabled : true,
          locked : false,
        }}
      }, 201, function(err, res, body) {
        var newEnt = body.data[0]
        t.assert(newEnt)

        // Add a user-created place about a mile away, at George's house
        t.post({
          uri: '/do/insertEntity?' + userCred,
          body: {entity: {
            name: 'A user-created Entity At George\'s House',
            type : 'com.aircandi.candi.place',
            place: {provider: {user: user._id}, lat: 47.664525, lng: -122.354787},
            visibility : "public",
            isCollection: true,
            enabled : true,
            locked : false,
          }}
        }, 201, function(err, res, body) {
          var newEnt2 = body.data[0]
          t.assert(newEnt2)

          // Run radar again
          t.post({
            uri: '/places/getNearLocation',
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
              t.assert(place.place.provider)
              if (place.place.provider.foursquare === ladroId) foundLadro++
              if (place._id && place._id === newEnt._id) {
                foundNewEnt++
                t.assert(place.place.provider.user === user._id)
              }
              if (place._id && place._id === newEnt2._id) {
                foundNewEnt2++
                t.assert(place.place.provider.user === user._id)
              }
            })
            t.assert(foundLadro === 1)
            t.assert(foundNewEnt === 1)
            t.assert(foundNewEnt2 === 0) // outside the radius

            // Now run radar with factual as the provider, ensuring the same
            // results, joining on phone number
            t.post({
              uri: '/places/getNearLocation',
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
                if (place._id && place._id === newEnt._id) foundNewEnt++
                if (place._id && place._id === newEnt2._id) foundNewEnt2++
                t.assert(place.place.provider)
                if (place.place.provider.foursquare === ladroId) {
                  foundLadro++
                  t.assert(place.place.provider.factual) // should have been added to the map
                }
              })
              t.assert(foundLadro === 1)
              t.assert(foundNewEnt === 1)
              t.assert(foundNewEnt2 === 0)

              // Confirm that excludePlaceIds works for our entities
              t.post({
                uri: '/places/getNearLocation',
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
    uri: '/places/getPhotos',
    body: {provider: 'foursquare', id: '4abebc45f964a520a18f20e3'}
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}

