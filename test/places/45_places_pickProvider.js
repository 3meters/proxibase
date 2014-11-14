/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var db = testUtil.db
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests



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

var northGateLoc = '47.706295,-122.325751'

exports.testProviderSpecificNear = function(test) {

  if (disconnected) return skip(test)

  t.get('/places/near?ll=' + northGateLoc +
      '&limit=20&radius=250&provider=foursquare|yelp&refresh=true&log=true',
  function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(place) {
      t.assert(place.provider)
      t.assert(place.provider.yelp || place.provider.foursquare)
      t.assert(!place.provider.google)
    })
    test.done()
  })
}
