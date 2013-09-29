/**
 *  Proxibase applink suggest test
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

var ksthaiId = '4a3d9c80f964a52088a21fe3'

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
    uri: '/applinks/suggest',
    body: {
      place: {
        provider: {foursquare: ksthaiId},
      },
      includeRaw: false,
      timeout: 20,
    }
  }, function(err, res, body) {
    var applinks = body.data
    t.assert(applinks.length > 3)
    var srcMap = {}
    applinks.forEach(function(applink) {
      srcMap[applink.type] = srcMap[applink.type] || 0
      srcMap[applink.type]++
    })
    t.assert(util.tipe.isUndefined(srcMap.factual))
    t.assert(srcMap.website === 1)
    t.assert(srcMap.foursquare === 1)
    t.assert(srcMap.twitter === 1)
    t.assert(srcMap.facebook >= 1) // One is not found, but we can't tell those from a alcohal serving business
    test.done()
  })
}
