/**
 *  Proxibase concurrent place provider test
 *
 *  Meant to be able to run with the mulitple instance option
 *
 *  test -m <instances> -i <interval (default 100)> -t basic/44*
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


exports.findNearPioneerSquareRepeatedlyDoesNotAddToDupes = function(test) {

  if (disconnected) return skip(test)

  var lat = 47.6016363
  var lng = -122.331157  // Pioneer Square
  var ll = String(lat) + ',' + String(lng)

  var dupeCount

  t.get('/find/dupes/count', function(err, res, body) {
    dupeCount = body.count
    t.get('/places/near?ll=' + ll + '&limit=50',
    function(err, res, body) {
      t.assert(body.data.length === 50)
      body.data.forEach(function(place) {
        t.assert(!place.name.match(/^Museum of Modern/))  // ignored sample data is in New York
      })
      t.get('/places/near?location[lat]=' + String(lat) + '&location[lng]=' + String(lng) + '&limit=50',
      function(err, res, body) {
        t.assert(body.data.length === 50)
        t.get('/places/near?ll=' + ll + '&limit=50',
        function(err, res, body) {
          t.get('/find/dupes/count', function(err, res, body) {
            t.assert(body.count === dupeCount) // same as first time
            test.done()
          })
        })
      })
    })
  })
}
