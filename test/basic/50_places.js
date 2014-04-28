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
  lat: 47.6521,
  lng: -122.3530,
}

var savedRoxy  // shared between tests

// Some persisted Ids. Factuals change periodically.
// Seattle Ballroom
var ballRoom4sId = '4abebc45f964a520a18f20e3'
var ballRoomFacId = '46aef19f-2990-43d5-a9e3-11b78060150c'
var ballRoomYelpId = 'the-ballroom-seattle'
var ballRoomGooId = 'f0147a535bedf4bb948f35379873cab0747ba9e2|aGoogleRef'

// Cafe Ladro
var ladroId = '45d62041f964a520d2421fe3'

// Roxys Diner
var roxyFacId = '021d77ee-2db5-4300-ae2b-5f841df77a4e'  // this changed 2013-Sep
var roxyGooId = 'd9083f5df362b2ed27c9e10339c9510960192624'
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
      radius: 500,
      includeRaw: true,
      limit: 50,
      waitForContent: true,
      timeout: 15000,
    }
  }, function(err, res, body) {
    var foundBallroom = 0
    var places = body.data
    t.assert(places.length === 50)
    placeCount = {
      aircandi: 0,
      foursquare: 0,
      google: 0,
      yelp: 0
    }
    places.forEach(function(place) {
      t.assert(place.provider)
      for (var p in place.provider) {
        placeCount[p]++
      }
      if (place.provider.foursquare === ballRoom4sId) foundBallroom++
      var cat = place.category
      t.assert(cat)
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
        t.assert(place.provider.yelp)
        t.assert(!place.provider.google)
        t.assert(!place.provider.foursquare)
      }
      // If yelp is our only provider, assert we have location accuracy
      if (place.provider.yelp && !place.provider.google && !place.provider.foursquare) {
        t.assert(place.location)
        t.assert(place.location.accuracy)
      }
    })
    t.assert(placeCount.aircandi === 50, placeCount)
    t.assert(placeCount.foursquare > 10, placeCount)
    t.assert(placeCount.yelp > 10, placeCount)
    t.assert(placeCount.google > 10, placeCount)
    t.assert(foundBallroom === 1, {foundBallroom: foundBallroom})
    test.done()
  })
}

exports.placesNearExcludeFoursquareId = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      excludePlaceIds: [ballRoom4sId], // The Ballroom's 4sId
      waitForContent: true,
      timeout: 15000,
    }
  }, function(err, res) {
    var places = res.body.data
    places.forEach(function(place) {
      t.assert(place.provider.foursquare !== ballRoom4sId)
      t.assert(place.provider.google !== ballRoomGooId)
      t.assert(place.provider.yelp !== ballRoomYelpId)
      t.assert(place.provider.factual !== ballRoomFacId)
    })
    test.done()
  })
}

exports.placesNearLocationExcludeGoogleId = function(test) {
  if (disconnected) return skip(test)

  var googleProvided = 0
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      radius: 200,
      limit: 50,
      excludePlaceIds: [ballRoomGooId],
      includeRaw: false,
      timeout: 20000,
    }
  }, function(err, res, body) {
    var places = body.data
    t.assert(49 <= places.length <= 50)
    places.forEach(function(place) {
      t.assert(place)
      t.assert(place.provider)
      if (place.provider.google) {
        googleProvided++
        t.assert(2 === place.provider.google.split('|').length)  //  id + '|' + refrence
        t.assert(ballRoomGooId !== place.provider.google.split('|')[0]) //excluded
      }
    })
    t.assert(googleProvided)
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
      radius: 500,
      limit: 50,
      includeRaw: false,
      waitForContent: true,
      log: false,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 50)
    var cAircandi = 0
    places.forEach(function(place) {
      t.assert(place.provider)
      if (place.provider.aircandi) cAircandi++
    })
    t.assert(cAircandi === places.length)
    var roxys = places.filter(function(place) {
      if (!place.provider.google) return false
      return (place.provider.google.split('|')[0] === roxyGooId.split('|')[0]) // Roxy's Diner
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
        timeout: 15000,
      }
    }, 201, function(err, res, body) {
      t.assert(body.data)
      savedRoxy = res.body.data
      t.assert(savedRoxy.provider.yelp === roxy.provider.yelp)
      t.assert(savedRoxy.linksIn && savedRoxy.linksIn.length >=2)
      savedRoxy.linksIn.forEach(function(link) {
        t.assert(link.shortcut)
        t.assert(link.shortcut.appId || link.shortcut.appUrl)
        t.assert(link.shortcut.app)
        t.assert(link.shortcut.app !== 'factual')
        t.assert(!link.icon)
      })
      t.assert(savedRoxy.linksIn.some(function(link) {
        return (link.shortcut.app === 'foursquare'
            && link.shortcut.photo
            && link.shortcut.photo.prefix
            && link.shortcut.photo.suffix
          )
      }))
      log('Missing facebook link, test was commented out')
      /*
      t.assert(savedRoxy.linksIn.some(function(link) {
        return (link.shortcut.app === 'facebook')
      }))
      */
      test.done()
    })
  }
}


exports.insertPlaceEntitySuggestApplinksFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    insertApplinks: true,
    entity: util.clone(testEntity),
  }
  body.entity.provider = {foursquare: ballRoom4sId}  // Seattle Ballroom
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res) {
      t.assert(res.body.data && res.body.data.linksIn)
      var links = res.body.data.linksIn
      t.assert(links.length > 3)
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'foursquare'
            && link.shortcut.appId === ballRoom4sId
          )
      }))
      t.assert(!links.some(function(link) {   // Invisible due to alcohal
        return (link.shortcut.app === 'facebook')
      }))
      log('Ballroom website is down')
      /*
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'website')
      }))
      */
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'twitter')
      }))
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'yelp')
      }))
      links.forEach(function(link) {
        t.assert(link.shortcut.app !== 'factual')
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
      limit: 50,
      waitForContent: true,
    }
  }, function(err, res, body) {
    var places = body.data
    var ksthai = null
    var cKsthai = 0
    var cYelp = 0
    var cGoogle = 0
    var cFoursquare = 0
    t.assert(50 === places.length)

    places.forEach(function(place) {
      if (place.name.match(/^Kaos/)) cKsthai++  // Look for dupes on name
      t.assert(place.location)
      t.assert(place.provider)
      if (place.provider.yelp) cYelp++
      if (place.provider.google) cGoogle++
      if (place.provider.foursquare) cFoursquare++
      if (ksthaiId === place.provider.foursquare) {
        ksthai = place
        if (cGoogle) t.assert(place.provider.google) // proves we merged them
      }
    })
    t.assert(ksthai)
    t.assert(1 === cKsthai)

    // Insert ksthai as an entity
    t.post({
      // uri: '/do/insertEntity?' + userCred,
      uri: '/do/insertEntity',  // upsize as anon
      body: {
        entity: ksthai,
        insertApplinks: true,
        includeRaw: false,
      }
    }, 201, function(err, res, body) {
      t.assert(body.data)
      ksthai = body.data
      t.assert(body.data._owner === admin._id)   // upsized places are owned by admin
      t.assert(body.data._modifier === util.anonId)
      var applinks = body.data.linksIn
      t.assert(applinks && applinks.length > 8)

      // Add a post to ksthai, first get it Id

      t.get('/data/posts/genId', function(err, res, body) {
        t.assert(body.data._id)
        var newPostId = body.data._id
        t.post({
          uri: '/do/insertEntity',  // add post as anon, should fail
          body: {
            entity: {
              _id: newPostId,
              schema: 'post',
              description: 'I am a post attached to Kaosamai Thai',
            },
            links: [{
              _to: ksthai._id,
              type: 'content',
            }],
          }
        }, 401, function(err, res, body) {
          t.post({
            uri: '/do/insertEntity?' + userCred,  // now as post as user, should work
            body: {
              entity: {
                _id: newPostId,
                schema: 'post',
                description: 'I am a post attached to Kaosamai Thai',
              },
              links: [{
                _to: ksthai._id,
                type: 'content',
              }],
            }
          }, 201, function(err, res, body) {
            t.assert(body.data)
            t.assert(body.data._id === newPostId)
            t.assert(body.data._owner === user._id)
            // Confirm link was created
            t.post({
              uri: '/find/links',
              body: {
                query: {
                  _to: ksthai._id,
                  _from: newPostId,
                },
              }
            }, function(err, res, body) {
              t.assert(body.data)
              t.assert(1 === body.data.length)
              var link = body.data[0]
              t.assert(link._creator === user._id)
              t.assert(link._owner === admin._id)   // strong links to entites are owned by ent owner
              t.assert('content' === link.type)

              // Add a user-created place inside the ballroom
              t.post({
                uri: '/do/insertEntity?' + userCred,
                body: {
                  entity: {
                    name: 'A user-created Test Place Inside the BallRoom',
                    schema : util.statics.schemaPlace,
                    provider: { aircandi: true }, // new
                    location: ballRoomLoc,
                    enabled : true,
                    locked : false,
                  },
                  insertApplinks: true,
                  includeRaw: true,
                }
              }, 201, function(err, res, body) {
                var newEnt = body.data
                t.assert(newEnt)
                t.assert(newEnt.provider.aircandi === newEnt._id)
                t.assert(body.raw)
                t.assert(Object.keys(body.raw).length === 0)  // proves that place seach did not occur, isssue 137

                // Add a user-created place about a mile away, at George's house
                t.post({
                  uri: '/do/insertEntity?' + userCred,
                  body: {entity: {
                    name: 'A user-created Entity At George\'s House',
                    schema : util.statics.schemaPlace,
                    provider: {aircandi: true},  // new
                    location: {lat: 47.664525, lng: -122.354787},
                    enabled : true,
                    locked : false,
                  }}
                }, 201, function(err, res, body) {
                  var newEnt2 = body.data
                  t.assert(newEnt2)

                  // Run radar again
                  t.post({
                    uri: '/places/near',
                    body: {
                      location: ballRoomLoc,
                      provider: 'foursquare',
                      limit: 50,
                      timeout: 15000,
                      waitForContent: true,
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
                        t.assert(place.provider.aircandi === place._id)
                      }
                      if (place._id && place._id === newEnt2._id) {
                        foundNewEnt2++
                      }
                    })
                    t.assert(foundKsthai === 1)
                    t.assert(foundNewEnt === 1)
                    log('Skipping test due to foursquare radius bug!')
                    // t.assert(foundNewEnt2 === 0) // outside the radius

                    // Now run radar with factual as the provider, ensuring the same
                    // results, joining on phone number
                    t.post({
                      uri: '/places/near',
                      body: {
                        location: ballRoomLoc,
                        waitForContent: true,
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
      })
    })
  })
}

exports.refreshPlace = function(test) {
  if (disconnected) return skip(test)

  var refreshWindow = 60 * 1000

  var placeId = savedRoxy._id
  var placeModifiedDate
  t.get('/data/places/' + placeId, function(err, res, body) {
    t.assert(body.data && body.data._id)
    placeModifiedDate = body.data.modifiedDate
    t.get('/places/' + placeId + '/refresh', function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.links)
      t.assert(body.data.links.from)
      t.assert(body.data.links.from.applinks)
      body.data.links.from.applinks.forEach(function(link) {
        t.assert(link.modifiedDate > placeModifiedDate)
        t.assert(link.document)
        t.assert((link.document.modifiedDate + refreshWindow) > placeModifiedDate, link)
      })
      test.done()
    })
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

