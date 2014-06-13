/**
 *  Proxibase more duplicate place provider tests
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

exports.dupePlaceDuos = function(test) {

  if (disconnected) return skip(test)

  var westSeattle = {
    lat: 47.569,
    lng: -122.371,
  }

  t.post({
    uri: '/places/near',
    body: {
      location: westSeattle,
      refresh: true,
      limit: 50,
      timeout: 15000,
    }
  }, function(err, res, body) {
    var cDuos = 0
    body.data.forEach(function(place) {
      if (place.name.match(/Duos/)) {
        cDuos++
      }
    })
    t.assert(2 === cDuos, cDuos)
    test.done()
  })
}


exports.getDups = function(test) {
  if (disconnected) return skip(test)
  t.get('/find/dupes?' + adminCred, function(err, res, body) {
    log('Dupe count:', body.count)
    test.done()
  })
}
