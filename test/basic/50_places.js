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

// Some persisted Ids.  No provider means 4square.  Factuals change periodically.
// Seattle Ballroom
var ballRoomId = '4abebc45f964a520a18f20e3'
var ballRoomFacId = '46aef19f-2990-43d5-a9e3-11b78060150c'
var ballRoomGooId = 'f0147a535bedf4bb948f35379873cab0747ba9e2'

// Cafe Ladro
var ladroId = '45d62041f964a520d2421fe3'

// Roxys Diner
var roxyFacId = '021d77ee-2db5-4300-ae2b-5f841df77a4e'  // this changed 2013-Sep
var roxyGooId = 'd9083f5df362b2ed27c9e10339c9510960192624'

// Kaosamai Thai
var ksthaiId = '4a3d9c80f964a52088a21fe3'

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
  t.get({uri: '/places/categories'}, function(err, res) {
    var cats = res.body.data
    t.assert(cats.length === 11)
    test.done()
  })
}

exports.getPlacesNearLocationFailsProperlyWithBadLimits = function(test) {
  var post = {
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      provider: 'foursquare',
      includeRaw: false,
      limit: 100,
    }
  }
  t.post(post, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(400.13 === body.error.code)
    // Google has a lower limit
    post.body.provider = 'google'
    post.body.limit = 30
    t.post(post, 400, function(err, res, body) {
      t.assert(body.error)
      t.assert(400.13 === body.error.code)
      test.done()
    })
  })
}

exports.getPlacesNearLocationFoursquare = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
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
      var cat = place.category
      t.assert(cat)
      t.assert(cat.id)
      t.assert(cat.name)
      t.assert(cat.photo)
      var iconFileName = path.join(util.statics.assetsDir, '/img/categories', cat.photo.prefix)
      t.assert(fs.existsSync(iconFileName))
    })
    t.assert(foundBallroom === 1)
    test.done()
  })
}

exports.getPlacesNearLocationExcludeWorks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
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
  var foundRoxy = false
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      provider: 'factual',
      radius: 200,
      limit: 20,
      excludePlaceIds: [ballRoomFacId],
      includeRaw: true,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length >= 8)
    places.forEach(function(place) {
      t.assert(place)
      t.assert(place.provider)
      t.assert(place.provider.factual)
      t.assert(ballRoomFacId !== place.provider.factual) //excluded
      var cat = place.category
      t.assert(cat)
      t.assert(cat.name)
      t.assert(cat.photo)
      var iconFileName = path.join(util.statics.assetsDir, '/img/categories', cat.photo.prefix)
      t.assert(fs.existsSync(iconFileName))
    })
    var roxys = places.filter(function(place) {
      return (place.provider.factual === roxyFacId) // Roxy's Diner
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
      var applinks = savedRoxy.entities // getEntities munges them all together
      t.assert(applinks)
      t.assert(applinks.length >= 2)
      applinks.forEach(function(applink) {
        t.assert(applink.type)
        t.assert(applink.type !== 'factual')
        t.assert(applink.appId || applink.appUrl)
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
      test.done()
    })
  }
}

exports.getPlacesNearLocationGoogle = function(test) {
  if (disconnected) return skip(test)

  var foundRoxy = 0
  var googleProvided = 0
  var factualProvided = 0
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      provider: 'google',
      radius: 100,
      limit: 10,
      excludePlaceIds: [ballRoomGooId],
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
      if (roxyGooId === place.provider.google) {
        foundRoxy++
        t.assert(place.address)
        t.assert(place.city)
        t.assert(place.region)
        t.assert(place.country)
        t.assert(place.postalCode)
      }
      var cat = place.category
      t.assert(cat)
      t.assert(cat.name)
      t.assert(cat.photo)
      var iconFileName = path.join(util.statics.assetsDir, '/img/categories', cat.photo.prefix)
      t.assert(fs.existsSync(iconFileName))
    })
    t.assert(1 === foundRoxy)
    t.assert(googleProvided)
    t.assert(factualProvided) // proves dupe merging on phone works
    test.done()
  })
}


exports.insertPlaceEntitySuggestApplinksFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    insertApplinks: true,
    entity: util.clone(testEntity),
  }
  body.entity.provider = {foursquare: ballRoomId}  // Seattle Ballroom
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      var applinks = res.body.data[0].entities
      t.assert(applinks)
      t.assert(applinks.length > 3)
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'foursquare'
            && applink.appId === ballRoomId
          )
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'facebook')
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'website')
      }))
      t.assert(applinks.some(function(applink) {
        return (applink.type === 'twitter')
      }))
      applinks.forEach(function(applink) {
        t.assert(applink.type !== 'factual')
      })
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

  // Fire up radar from the Ball Room
  t.post({
    uri: '/places/near',
    body: {
      location:  ballRoomLoc,
      provider: 'foursquare',
    }
  }, function(err, res, body) {
    var places = body.data
    var ksthai = null
    var hasFactualProviderId = 0
    t.assert(places.length > 10)
    places.forEach(function(place) {
      t.assert(place.provider)
      if (place.provider.factual) {
        hasFactualProviderId++
        t.assert(place.provider.foursquare) // we merged them
      }
      if (ksthaiId === place.provider.foursquare) {
        ksthai = place
      }
    })
    t.assert(ksthai)

    // We added a Roxy entity above, sourced from factual.
    // This proves we have merged multiple provider ids onto
    // single entity
    t.assert(hasFactualProviderId)

    // Insert ksthai as an entity
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: ksthai,
        insertApplinks: true,
        includeRaw: true
      }
    }, 201, function(err, res, body) {
      t.assert(body.data && body.data[0])
      ksthai = body.data[0]  // TODO, test for changes!
      var applinks = body.data[0].entities
      t.assert(applinks && applinks.length > 10)

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
            uri: '/places/near',
            body: {
              location: ballRoomLoc,
              provider: 'foursquare',
            }
          }, function(err, res, body) {
            // Make sure the real entitiy is in the found places
            var places = body.data
            var foundKsthai = 0
            var foundNewEnt = 0
            var foundNewEnt2 = 0
            places.forEach(function(place) {
              t.assert(place.provider)
              if (place.provider.foursquare === ksthaiId) foundKsthai++
              if (place._id && place._id === newEnt._id) {
                foundNewEnt++
                t.assert(place.provider.aircandi)
                t.assert(place.provider.aircandi === 'aircandi')
              }
              if (place._id && place._id === newEnt2._id) {
                foundNewEnt2++
              }
            })
            t.assert(foundKsthai === 1)
            t.assert(foundNewEnt === 1)
            t.assert(foundNewEnt2 === 0) // outside the radius

            // Now run radar with factual as the provider, ensuring the same
            // results, joining on phone number
            t.post({
              uri: '/places/near',
              body: {
                location: ballRoomLoc,
                provider: 'factual',
                limit: 50,
              }
            }, function(err, res, body) {
              var places = body.data
              var foundKsthai = 0
              var foundNewEnt = 0
              var foundNewEnt2 = 0
              places.forEach(function(place) {
                if (place._id && place._id === newEnt._id) foundNewEnt++
                if (place._id && place._id === newEnt2._id) foundNewEnt2++
                t.assert(place.provider)
                if (place.provider.foursquare === ksthaiId) {
                  foundKsthai++
                  t.assert(place.provider.factual) // should have been added to the map
                }
              })
              t.assert(foundKsthai === 1)
              t.assert(foundNewEnt === 1)
              t.assert(foundNewEnt2 === 0)

              // Confirm that excludePlaceIds works for our entities
              t.post({
                uri: '/places/near',
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
}

exports.insertDuplicatePlaceMergesIt = function(test) {
  placeId = ''
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: {
        name: 'Zoka1',
        schema: util.statics.schemaPlace,
        provider: {
          foursquare: '41b3a100f964a520681e1fe3',
        },
        phone: '2065454277',
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data.length)
    placeId = body.data[0]._id
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: {
          name: 'Zoka2',
          schema: util.statics.schemaPlace,
          provider: {
            factual: 'fdc45418-be3b-4ab9-92d6-62ae6fb6ce48',
          },
          phone: '2065454277',
        }
      }
    }, 201, function(err, res, body) {
      t.assert(body.data && body.data.length)
      var place = body.data[0]
      t.assert(placeId === place._id) // proves merged on phone number
      t.assert('Zoka1' === place.name)
      t.assert(place.provider.foursquare)
      t.post({
        uri: '/do/insertEntity?' + userCred,
        body: {
          entity: {
            name: 'Zoka3',
            schema: util.statics.schemaPlace,
            provider: {
              factual: 'fdc45418-be3b-4ab9-92d6-62ae6fb6ce48',
            },
          }
        }
      }, 201, function(err, res, body) {
        t.assert(body.data && body.data.length)
        var place = body.data[0]
        t.assert(placeId === place._id) // proves merged on provider Id
        t.assert('Zoka1' === place.name)
        t.assert(place.provider.foursquare)
        t.assert(place.provider.factual)
        test.done()
      })
    })
  })
}

exports.getPlacePhotos = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/photos',
    body: {
      provider: 'foursquare',
      id: ballRoomId,
    }
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}

