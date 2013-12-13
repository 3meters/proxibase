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

var outlander
var outlanderLoc = {
  lat: 47.6523894,
  lng: -122.3555151,
}

exports.insertPlaceFoursquareSaveApplinks = function(test) {
  if (disconnected) return skip(test)
  var post = {
    uri: '/places/near',
    body: {
      location: outlanderLoc,
      provider: 'foursquare',
      includeRaw: false,
      limit: 100,
    }
  }
  t.post(post, function(err, res, body) {
    body.data.forEach(function(place) {
      if (/^Outlander/.test(place.name)) {
        outlander = place
        return
      }
    })
    t.assert(outlander)
    var post = {
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: outlander,
        insertApplinks: true,
        applinksTimeout: 10000,
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
      t.assert(1 === applinkMap.website)
      log('skipping the facebook test: too flaky')
      // t.assert(1 === applinkMap.facebook)
      t.assert(1 === applinkMap.googleplus)
      t.assert(1 === applinkMap.foursquare)
      t.assert(1 === applinkMap.twitter)
      outlander = place
      test.done()
    })
  })
}

exports.googlePlaceDedupesWhenRefChanges = function(test) {
  if (disconnected) return skip(test) // Has a dependency on previous test
  var dupe = {
    name: outlander.name,
    schema: 'place',
    provider: util.clone(outlander.provider),
    location: outlanderLoc,
  }
  var googleId = outlander.provider.google.split('|')
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
    t.assert(place._id === outlander._id)
    t.assert(outlander.provider.google === place.provider.google)  // the update was discarded
    cleanup(place, function() {
      test.done()
    })
  })
}

exports.insertPlaceGoogleSaveApplinks = function(test) {
  ltd = null
  if (disconnected) return skip(test)
  var post = {
    uri: '/places/near',
    body: {
      location: outlanderLoc,
      provider: 'google',
      includeRaw: true,
      radius: 100,
      limit: 50,
      log: true
    }
  }
  t.post(post, function(err, res, body) {
    body.data.forEach(function(place) {
      if (/^LTD/.test(place.name)) {
        ltd = place
        return
      }
    })
    t.assert(ltd)
    var post = {
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: ltd,
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

      ltd = place
      cleanup(ltd, function(err) {
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
