/**
 *  Proxibase upsize entity save applinks test
 */

var util = require('proxutils')
var async = require('async')
var log = util.log
var serviceUri = util.config.service.uri
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var userCred
var adminCred
var _exports = {} // for commenting out tests

var seventyfourth
var seventyfourthLoc = {
  lat: 47.682681,
  lng: -122.355431,
}

var id = '40b13b00f964a5201df61ee3'

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

exports.insertPlaceFoursquareSaveApplinks = function(test) {
  if (disconnected) return skip(test)
  var post = {
    uri: '/places/near',
    body: {
      location: seventyfourthLoc,
      provider: 'foursquare',
      includeRaw: false,
      timeout: 20000,
      limit: 50,
    }
  }
  t.post(post, function(err, res, body) {
    body.data.forEach(function(place) {
      if (/^74th/.test(place.name)) {
        seventyfourth = place
        return
      }
    })
    t.assert(seventyfourth)
    var post = {
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: seventyfourth,
        insertApplinks: true,
        applinksTimeout: 15000,
        includeRaw: true,
        log: true,
      }
    }
    t.post(post, 201, function(err, res, body) {
      var place = body.data
      t.assert(place && place._id)
      t.assert(place.provider.foursquare)
      t.assert(place.provider.google)
      var applinkMap = {}
      place.linksIn.forEach(function(link) {
        if (!applinkMap[link.shortcut.app]) {
          applinkMap[link.shortcut.app] = 1
        }
        else applinkMap[link.shortcut.app]++
      })
      t.assert(2 === applinkMap.website, applinkMap)
      log('facebook has a dupe place that we cannot detect')
      t.assert(2 >= applinkMap.facebook >= 1, applinkMap)
      t.assert(1 === applinkMap.foursquare, applinkMap)
      t.assert(1 === applinkMap.googleplus, applinkMap)
      t.assert(1 >= applinkMap.twitter, applinkMap)
      seventyfourth = place
      test.done()
    })
  })
}

exports.googlePlaceDedupesWhenRefChanges = function(test) {
  if (disconnected) return skip(test)
  var dupe = {
    name: seventyfourth.name,
    schema: 'place',
    provider: util.clone(seventyfourth.provider),
    location: seventyfourthLoc,
  }
  var googleId = seventyfourth.provider.google.split('|')
  dupe.provider.google = googleId[0] + '|' + 'IamAFakeGoogleRefString'
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: dupe,
      insertApplinks: true,
      applinksTimeout: 10000,
      log: true,
    }
  }, 403, function(err, res, body) {
    var place = body.data
    t.assert(place)
    t.assert(place._id === seventyfourth._id)
    t.assert(seventyfourth.provider.google === place.provider.google)  // the update was discarded
    cleanup(place, function() {
      test.done()
    })
  })
}

exports.insertPlaceGoogleSaveApplinks = function(test) {
  if (disconnected) return skip(test)
  var herkimer = null
  var post = {
    uri: '/places/near',
    body: {
      location: seventyfourthLoc,
      provider: 'google',
      includeRaw: true,
      radius: 100,
      limit: 50,
      log: true
    }
  }
  t.post(post, function(err, res, body) {
    body.data.forEach(function(place) {
      if (/^Herkimer/.test(place.name)) {
        return herkimer = place
      }
    })
    t.assert(herkimer)
    var post = {
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: herkimer,
        insertApplinks: true,
        applinksTimeout: 15000,
        includeRaw: true,
        log: true,
      }
    }
    t.post(post, 201, function(err, res, body) {
      var place = body.data
      t.assert(place && place._id)
      t.assert(place.provider.foursquare)
      log('skiping testing place.provider.factual')
      // t.assert(place.provider.factual)
      t.assert(place.provider.google)
      t.assert(place.photo)
      t.assert('google' === place.photo.source)
      t.assert(place.photo.prefix)
      // TODO: call google and verify the URL
      // remember, must append maxwidth=<1..1600> to the url to get a picture back
      var applinkMap = {}
      place.linksIn.forEach(function(link) {
        if (!applinkMap[link.shortcut.app]) {
          applinkMap[link.shortcut.app] = 1
        }
        else applinkMap[link.shortcut.app]++
      })
      t.assert(applinkMap.website === 1)
      t.assert(applinkMap.facebook === 1)
      t.assert(applinkMap.googleplus === 1)
      t.assert(applinkMap.foursquare === 1)
      t.assert(applinkMap.yelp === 1)
      t.assert(applinkMap.urbanspoon === 1)  // proves that factual lookup works

      herkimer = place
      cleanup(herkimer, function(err) {
        test.done()
      })
    })
  })
}

// return the db to a clean state.  twould be nice if the test harness did
// this automatically between test files.
function cleanup(place, cb) {
  var post = {
    uri: '/do/deleteEntity?' + adminCred,
    body: {entityId: place._id}
  }
  t.post(post, function(err, res, body) {
    if (err) throw err
    cb()
  })
}
