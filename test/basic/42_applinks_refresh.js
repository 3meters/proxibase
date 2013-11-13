/**
 *  Proxibase applink refresh test
 */

var util = require('proxutils')
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


//  https://foursquare.com/v/kaosamai/4a3d9c80f964a52088a21fe3
exports.kaosamai = function(test) {

  if (disconnected) return skip(test)
  var ksthaiId = '4a3d9c80f964a52088a21fe3'
  t.post({
    uri: '/data/places?' + userCred,
    body: {
      data: {
        name: 'Kaosamai',
        location: {
          lat: 47.65231671757836,
          lng: -122.35407382249832,
        },
        provider: {foursquare: ksthaiId},
      },
    }
  }, 201, function(err, res, body) {
    var place = body.data
    t.assert(place && place._id)
    t.post({
      uri: '/applinks/refresh?' + userCred,
      body: {
        placeId: place._id,
        includeRaw: true,
        timeout: 20,
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
      t.assert(appMap.website === 1)
      t.assert(appMap.foursquare === 1)
      t.assert(appMap.twitter === 1)
      t.assert(appMap.facebook === 1) // One is not found, but we can't tell those from a alcohal serving business
      test.done()
    })
  })
}
