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
_exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


_exports.getPlacesNearLocationGoogle = function(test) {
  if (disconnected) return skip(test)

  var foundRoxy = 0
  var googleProvided = 0
  var factualProvided = 0
  t.post({
    uri: '/places/near',
    body: {
      location: ballRoomLoc,
      provider: 'google',
      radius: 200,
      limit: 50,
      excludePlaceIds: [ballRoomGooId],
      includeRaw: true,
    }
  }, function(err, res, body) {
    var places = body.data
    t.assert(places.length === 50)  // default
    places.forEach(function(place) {
      t.assert(place)
      t.assert(place.provider)
      if (place.provider.google) {
        googleProvided++
        t.assert(2 === place.provider.google.split('|').length)  //  id + '|' + refrence
      }
    })
    t.assert(googleProvided)
    t.assert(false)
    test.done()
  })
}
