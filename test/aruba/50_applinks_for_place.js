/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests

// Inside Lincon center bellevue
var loc = {
  lat: 47.616958,
  lng: -122.201244,
}

// Module globals
var foundPlace = null
var time1 = null
var cApplinks = null

// Get user and admin sessions and store the credentials in module globals
// All these are ok anon, so skipping for now
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


exports.getPlacesNearLocation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: loc,
      limit: 20,
    }
  }, function(err, res, body) {
    var places = body.data
    var cPlaces = 0
    time1 = body.time
    t.assert(time1)
    places.forEach(function(place) {
      t.assert(place.provider)
      if (place.namelc.match(/^mccormic/)) {
        cPlaces++
        foundPlace = place
      }
    })
    t.assert(1 === cPlaces)
    t.assert(!foundPlace.applinkDate)
    test.done()
  })
}


exports.getApplinksForPlace = function(test) {
  if (disconnected) return skip(test)
  t.get('/applinks/place/' + foundPlace._id,
  function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.place)
    t.assert(body.place.applinkDate)
    cApplinks = body.data.length
    t.assert(body.data.length)
    t.post({
      uri: '/do/getEntitiesForEntity',
      body: {
        entityId: foundPlace._id,
        cursor: {
          linkTypes: [util.statics.typeContent],
          schemas: [util.statics.schemaApplink],
          direction: 'in',
        },
      }
    }, function(err, res, body) {
      var applinks = body.data
      t.assert(body.data.length === cApplinks)
      t.assert(applinks && applinks.length)
      var applinkMap = {}
      applinks.forEach(function(applink) {
        // debug(applink.type + ' '  + applink.appId)
        if (!util.tipe.isNumber(applinkMap[applink.type])) {
          applinkMap[applink.type] = 0
        }
        applinkMap[applink.type]++
      })
      t.assert(applinkMap.twitter === 1, applinkMap)
      t.assert(applinkMap.website === 2, applinkMap)
      t.assert(applinkMap.facebook === 1, applinkMap)
      t.assert(applinkMap.yelp === 1, applinkMap)
      t.assert(applinkMap.foursquare === 1, applinkMap)
      test.done()
    })
  })
}

exports.getApplinksAgain = function(test) {
  if (disconnected) return skip(test)
  t.get('/places/' + foundPlace._id + '/applinks',  // note alternative syntax
  function(err, res, body) {
    t.assert(body && body.data)
    t.assert(body.data.length = cApplinks)
    t.assert((body.time * 4) < time1, {time1: time1, time2: body.time})  // proves refresh window works
    test.done()
  })
}
