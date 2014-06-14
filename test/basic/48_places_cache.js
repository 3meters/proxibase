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


exports.findNearPioneerSquareIsFasterCached = function(test) {

  if (disconnected) return skip(test)

  var ll = '47.6016363,-122.331157'  // Pioneer Square
  var time1, time2, time3

  t.get('/places/near?ll=47.6016363,-122.331157&refresh=1&limit=50',
  function(err, res, body) {
    t.assert(body.data.length === 50)
    time1 = body.time
    t.assert(time1)
    t.get('/places/near?ll=47.6016363,-122.331157&refresh=1&limit=50',
    function(err, res, body) {
      t.assert(body.data.length === 50)
      time2 = body.time
      t.assert(time2)
      if (time1 !== time2) {
        // No more than 50% faster or slower than first run
        t.assert((Math.abs((time1 - time2) / time1) < .5), {time1: time1, time2: time2})
      }
      t.get('/places/near?ll=47.6016363,-122.331157&limit=50',
      function(err, res, body) {
        t.assert(body.data.length === 50)
        time3 = body.time
        t.assert(time3 !== time2)
        // Returning cached places is at least 80% faster than non-cached
        t.assert((Math.abs((time2 - time3) / time2) > .8), {time2: time2, time3: time3})
        test.done()
      })
    })
  })
}
