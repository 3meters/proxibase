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
var _exports = {} // for commenting out tests

var ballRoomLoc = {
  lat: 47.652084,
  lng: -122.353025,
}

// Seattle Ballroom
var ballRoomId = ''
var ballRoom4sId = '4abebc45f964a520a18f20e3'

// Cafe Ladro
var ladroId = '45d62041f964a520d2421fe3'

// Roxys Diner
var roxyId = ''
var roxyFoursquareId = '49cd242ef964a520bf591fe3'

// Kaosamai Thai
var ksthaiFoursquareId = '4a3d9c80f964a52088a21fe3'

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
      radius: 500,
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
      if (place.name.match(/^Kaos/)
          || place.provider.foursquare === ksthaiFoursquareId) {
        cKsthai++  // Look for dupes on name or id
        ksthai = place
      }
      t.assert(place.location, place)
      t.assert(place.provider, place)
    })
    t.assert(ksthai)
    t.assert(1 === cKsthai)

    // Insert ksthai as an entity
    t.post({
      // uri: '/do/insertEntity?' + userCred,
      uri: '/do/insertEntity',  // upsize as anon
      body: {
        entity: ksthai,
        insertApplinks: false,
        includeRaw: false,
      }
    }, 201, function(err, res, body) {
      t.assert(body.data)
      ksthai = body.data
      t.assert(body.data._owner === admin._id)   // upsized places are owned by admin
      t.assert(body.data._modifier === util.anonId)

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
                    provider: { aircandi: 'aircandi' }, // new
                    location: ballRoomLoc,
                    enabled : true,
                    locked : false,
                  },
                  insertApplinks: false,
                }
              }, 201, function(err, res, body) {
                var newEnt = body.data
                t.assert(newEnt)
                t.assert(newEnt.provider.aircandi === 'aircandi')

                // Add a user-created place about a mile away, at George's house
                t.post({
                  uri: '/do/insertEntity?' + userCred,
                  body: {entity: {
                    name: 'A user-created Entity At George\'s House',
                    schema : util.statics.schemaPlace,
                    provider: {aircandi: 'aircandi'},  // new
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
                      t.assert(place.provider, place)
                      if (place.name.match(/^Kaos/)) foundKsthai++
                      if (place._id && place._id === newEnt._id) {
                        foundNewEnt++
                      }
                      if (place._id && place._id === newEnt2._id) {
                        foundNewEnt2++
                      }
                    })
                    t.assert(foundKsthai === 1)
                    t.assert(foundNewEnt === 1)
                    t.assert(foundNewEnt2 === 0) // outside the radius

                    // Now run radar again, ensuring the same
                    // results, joining on phone number
                    t.post({
                      uri: '/places/near',
                      body: {
                        location: ballRoomLoc,
                        radius: 500,
                        waitForContent: false,
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
                        t.assert(place.provider, place)
                        if (place.provider.foursquare === ksthaiFoursquareId
                            || place.name.match('Kaosamai')) {
                          foundKsthai++
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

  var placeId
  var placeModifiedDate
  t.get('/data/places?name=roxy', function(err, res, body) {
    t.assert(body.data && body.data.length === 1)
    placeModifiedDate = body.data[0].modifiedDate
    placeId = body.data[0]._id
    t.get('/places/' + placeId + '/refresh', function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.links)
      t.assert(body.data.links.from)
      t.assert(body.data.links.from.applinks)
      t.assert(body.data.links.from.applinks.length)
      body.data.links.from.applinks.forEach(function(link) {
        t.assert(link.modifiedDate > placeModifiedDate)
        t.assert(link.document)
        t.assert((link.document.modifiedDate + refreshWindow) > placeModifiedDate, link)
      })
      test.done()
    })
  })
}

