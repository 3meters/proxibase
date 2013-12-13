/**
 *  Proxibase applink save test
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


exports.ferryFoodCourt = function(test) {

  if (disconnected) return skip(test)
  var foursquareId = '4aabf863f964a5204a5b20e3'

  t.post({
    uri: '/data/places?' + userCred,
    body: {
      data: {
        name: 'Bainbridge Ferry Food Court',
        location: {
          // note this thing moves
          lng: -122.33885330217869,
          lat: 47.60289691933644,
        },
        provider: {foursquare: foursquareId},
      },
    }
  }, 201, function(err, res, body) {
    var place = body.data
    t.assert(place && place._id)
     t.post({
      uri: '/applinks/get?' + userCred,
      body: {
        placeId: place._id,
        save: true,
        includeRaw: true,
        log: true,
        timeout: 20000,
      }
    }, function(err, res, body) {

      var applinks = body.data
      t.assert(applinks && applinks.length)
      var raw = body.raw
      t.assert(raw)
      var appMap = {}
      applinks.forEach(function(applink) {
        appMap[applink.type] = appMap[applink.type] || 0
        appMap[applink.type]++
      })
      t.assert(util.tipe.isUndefined(appMap.factual))
      t.assert(appMap.foursquare === 1)
      cleanup(place, applinks, function(err) {
        test.done()
      })
    })
  })
}



exports.commuterComforts = function(test) {

  if (disconnected) return skip(test)
  var foursquareId = '4afcb779f964a520502522e3'

  t.post({
    uri: '/data/places?' + userCred,
    body: {
      data: {
        name: 'Commuter Comforts Cafe & Wine Bar',
        location: {
          lng: -122.33881163333334,
          lat: 47.602832,
        },
        provider: {foursquare: foursquareId},
      }
    }
  }, 201, function(err, res, body) {
    var place = body.data
    t.assert(place && place._id)
     t.post({
      uri: '/applinks/get?' + userCred,
      body: {
        placeId: place._id,
        save: true,
        includeRaw: true,
        log: true,
        timeout: 20000,
      }
    }, function(err, res, body) {

      var applinks = body.data
      t.assert(applinks && applinks.length)
      var raw = body.raw
      t.assert(raw)
      var appMap = {}
      applinks.forEach(function(applink) {
        appMap[applink.type] = appMap[applink.type] || 0
        appMap[applink.type]++
      })
      t.assert(util.tipe.isUndefined(appMap.factual))
      t.assert(appMap.facebook === 1)
      t.assert(appMap.foursquare === 1)
      t.assert(appMap.yelp === 1)
      t.assert(appMap.citygrid === 1)
      t.assert(appMap.urbanspoon === 1)

      cleanup(place, applinks, function(err) {
        test.done()
      })
    })
  })
}


// return the db to a clean state.  twould be nice if the test harness did
// this automatically between test files.
function cleanup(place, applinks, cb) {

  async.eachSeries(applinks, removeApplink, function(err) {
    t.assert(!err)
    t.delete({uri: '/data/places/' + place._id + '?' + adminCred}, function(err, res, body) {
      t.assert(1 === body.count)
      cb()
    })
  })
  function removeApplink(applink, next) {
    t.get('/data/links?filter[_from]=' + applink._id + '&filter[_to]=' + place._id,
    function(err, res, body) {
      t.assert(1 === body.data.length)
      t.delete({uri: '/data/links/' + body.data[0]._id + '?' + adminCred}, function(err, res, body) {
        t.assert(1 === body.count)
        t.delete({uri: '/data/applinks/' + applink._id + '?' + adminCred}, function(err, res, body) {
          t.assert(1 === body.count)
          next()
        })
      })
    })
  }
}
