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
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
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
  lat: 47.6521,
  lng: -122.3530,
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

exports.getCategories = function(test) {
  t.get({uri: '/places/getCategories'}, function(err, res) {
    var cats = res.body.data
    t.assert(cats && cats.length > 5)
    t.assert(cats[0].photo)
    t.assert(cats[0].photo.prefix.length > 20)
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
      location: ballRoomLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 10,
    }
  }, function(err, res, body) {
    var foundBallroom = 0
    var places = body.data
    // t.assert(places.length === 10)
    places.forEach(function(place) {
      t.assert(place.provider)
      if (place.provider.foursquare === ballRoomId) foundBallroom++
      t.assert(place.category)
      t.assert(place.category.name)
      t.assert(place.category.photo)
      t.assert(/^\/img\/categories\/foursquare\/.*_88\.png$/.test(place.category.photo.prefix))
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
      location: ballRoomLoc,
      provider: 'foursquare',
      radius: 500,
      excludePlaceIds: [ballRoomId], // The Ballroom's 4sId
    }
  }, function(err, res) {
    var places = res.body.data
    places.forEach(function(place) {
      t.assert(place.provider.foursquare.id !== ballRoomId)
    })
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
      location: ballRoomLoc,
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
      t.assert(place)
      t.assert(place.provider)
      t.assert(place.provider.factual)
      t.assert(ballRoomId !== place.provider.factual) //excluded
      t.assert(place.category)
      t.assert(place.category.name)
      t.assert(place.category.photo)
    })
    var roxys = places.filter(function(place) {
      return (place.provider.factual === roxyId) // Roxy's Diner
    })
    t.assert(roxys.length === 1)
    insertEnt(roxys[0])
  })

  // Insert the roxy diner and make sure her applinks come out right
  function insertEnt(roxy) {
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: roxy,
        insertApplinks: true,
        includeRaw: true,
      }
    }, 201, function(err, res, body) {
      t.assert(body.data.length)
      var savedRoxy = res.body.data[0]
      t.assert(savedRoxy.provider.factual === roxy.provider.factual)
      t.post({
        uri: '/do/getEntities?' + userCred,
        body: {
          entityIds: [savedRoxy._id],
          subqueries: true,
          links: {
            active: [
              { type: util.statics.schemaApplink, load: true, links: true, count: true, direction: 'out' },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.data && body.data.length)
        var roxEnt = body.data[0]
        t.assert(savedRoxy._id === roxEnt._id)
        var applinks = roxEnt.entities // getEntities munges them all together
        t.assert(applinks)
        t.assert(applinks.length >= 2)
        applinks.forEach(function(applink) {
          t.assert(applink.type)
          if (applink.type === 'factual') t.assert(applink.system)
          t.assert(applink.id || applink.url)
          t.assert(!applink.icon)
          t.assert(applink.data)
          t.assert(applink.data.origin)
        })
        t.assert(applinks.some(function(applink) {
          return (applink.type === 'foursquare'
              && applink.photo
              && applink.photo.prefix
              && applink.photo.suffix
            )
        }))
        t.assert(applinks.some(function(applink) {
          return (applink.type === 'facebook')
        }))
        t.assert(applinks.some(function(applink) {
          return (applink.type === 'factual'
              && applink.system
            )
        }))
        test.done()
      })
    })
  }
}

exports.getPlacesNearLocationGoogle = function(test) {
  // if (disconnected) return skip(test)

  var ballRoomId = 'f0147a535bedf4bb948f35379873cab0747ba9e2'
  var roxyId = 'd9083f5df362b2ed27c9e10339c9510960192624'

  var foundRoxy = 0
  var googleProvided = 0
  var factualProvided = 0
  t.post({
    uri: '/places/getNearLocation',
    body: {
      location: ballRoomLoc,
      provider: 'google',
      radius: 100,
      limit: 10,
      excludePlaceIds: [ballRoomId],
      includeRaw: false,
    }
  }, function(err, res, body) {
    var places = body.data
    t.assert(places.length === 10)
    places.forEach(function(place) {
      t.assert(place)
      t.assert(place.provider)
      if (place.provider.google) {
        googleProvided++
        t.assert(place.provider.googleReference, place)
      }
      if (place.provider.factual) {
        factualProvided++
      }
      // Not all places returned need to have place.provider.google
      // They can be entities we already have in our system given by
      // foursquare, factual, or user
      t.assert(ballRoomId !== place.provider.google) //excluded
      t.assert(place.location.lat)
      t.assert(place.location.lng)
      if (roxyId === place.provider.google) {
        foundRoxy++
        t.assert(place.address)
        t.assert(place.city)
        t.assert(place.region)
        t.assert(place.country)
        t.assert(place.postalCode)
      }
      t.assert(place.category)
      t.assert(place.category.name)
      t.assert(place.category.photo)
    })
    t.assert(1 === foundRoxy)
    t.assert(googleProvided)
    t.assert(factualProvided) // proves dupe merging on phone works
    test.done()
  })
}


// I think this test is covered by the previous and the next
_exports.insertPlaceEntitySuggestApplinksFromFactual = function(test) {
  log('fix:')
  return test.done()
  if (disconnected) return skip(test)
  var body = {
    insertApplinks: true,
    entity: util.clone(testEntity),
  }
  body.entity.applinks = [{
    type: 'foursquare',
    id: '4abebc45f964a520a18f20e3'  // Seattle Ballroom
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      t.assert(res.body.data[0].applinks)
      var applinks = res.body.data[0].applinks
      t.assert(applinks.length > 3) 
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'foursquare'
            && applink.id === '4abebc45f964a520a18f20e3'
          )
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'facebook')
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'website')
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'factual')
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'twitter')
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
      location:  ballRoomLoc,
      provider: 'foursquare',
    }
  }, function(err, res, body) {
    var places = body.data
    var ladro = null
    var hasFactualProviderId = 0
    t.assert(places.length > 10)
    places.forEach(function(place) {
      t.assert(place.provider)
      if (place.provider.factual) {
        hasFactualProviderId++
        t.assert(place.provider.foursquare) // we merged them
      }
      if (ladroId === place.provider.foursquare) {
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
      body: {
        entity: ladro,
        insertApplinks: true,
        includeRaw: true
      }
    }, 201, function(err, res, body) {
      
      t.assert(body.data && body.data[0])
      ladro = body.data[0]  // TODO, test for changes!
      
      // Call getEntities to see if the applinks were wired in correctly
      t.post({
        uri: '/do/getEntities?' + userCred,
        body: {
          entityIds: [ladro._id],
          subqueries: true,
          links: {
            active: [
              { type: util.statics.schemaApplink, load: true, links: true, count: true, direction: 'out' },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.data && body.data[0])
        var applinks = body.data[0].entities
        t.assert(applinks)
        var srcMap = {}
        applinks.forEach(function(applink) {
          srcMap[applink.type] = srcMap[applink.type] || 0
          srcMap[applink.type]++
        })
        t.assert(srcMap.factual === 1)
        t.assert(srcMap.website === 1)
        t.assert(srcMap.foursquare === 1)
        // t.assert(srcMap.facebook >= 1)
        t.assert(srcMap.twitter >= 1)

        // Add a user-created place inside the ballroom
        t.post({
          uri: '/do/insertEntity?' + userCred,
          body: {
            entity: {
              name: 'A user-created Test Entity Inside the BallRoom',
              schema : util.statics.schemaPlace,
              // provider: { aircandi: user._id },  old
              provider: { aircandi: true }, // new
              location: ballRoomLoc,
              enabled : true,
              locked : false,
            }
          }
        }, 201, function(err, res, body) {
          var newEnt = body.data[0]
          t.assert(newEnt)

          // Add a user-created place about a mile away, at George's house
          t.post({
            uri: '/do/insertEntity?' + userCred,
            body: {entity: {
              name: 'A user-created Entity At George\'s House',
              schema : util.statics.schemaPlace,
              // provider: {user: user._id}, old
              provider: {aircandi: true},  // new
              location: {lat: 47.664525, lng: -122.354787},
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
                location: ballRoomLoc,
                provider: 'foursquare',
              }
            }, function(err, res, body) {
              // Make sure the real entitiy is in the found places
              var places = body.data
              var foundLadro = 0
              var foundNewEnt = 0
              var foundNewEnt2 = 0
              places.forEach(function(place) {
                t.assert(place.provider)
                if (place.provider.foursquare === ladroId) foundLadro++
                if (place._id && place._id === newEnt._id) {
                  foundNewEnt++
                  // t.assert(place.provider.aircandi === user._id)
                  t.assert(place.provider.aircandi)
                  t.assert(place.provider.aircandi === 'aircandi')  // should be en
                }
                if (place._id && place._id === newEnt2._id) {
                  foundNewEnt2++
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
                  location: ballRoomLoc,
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
                  t.assert(place.provider)
                  if (place.provider.foursquare === ladroId) {
                    foundLadro++
                    t.assert(place.provider.factual) // should have been added to the map
                  }
                })
                t.assert(foundLadro === 1)
                t.assert(foundNewEnt === 1)
                t.assert(foundNewEnt2 === 0)

                // Confirm that excludePlaceIds works for our entities
                t.post({
                  uri: '/places/getNearLocation',
                  body: {
                    location: ballRoomLoc,
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
  })
}

exports.getPlacePhotos = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/getPhotos',
    body: {
      provider: 'foursquare', 
      id: '4abebc45f964a520a18f20e3'
    }
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}

