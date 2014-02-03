/**
 *  Proxibase place provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random
 *     web pages and services existing on the web.  Fine to move out of basic
 *     once the feature area is stable.
 */

var util = require('proxutils')
var async = require('async')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var admin
var userCred
var adminCred

var mokshaId = '505d321ee4b05434c0cfdbbd'
var moksha = {
  name: 'Moksha',
  schema: 'place',
  provider: {
    foursquare: mokshaId
  },
}

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      admin = {_id: session._owner}
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.insertMoksha = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: moksha,
      insertApplinks: false,
      includeRaw: true,
      timeout: 15000,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    moksha._id = body.data._id
    test.done()
  })
}

exports.getMokshaApplinks = function(test) {
  t.post({
    uri: '/applinks/get?' + userCred,
    body: {
      placeId: moksha._id,
      save: true, // try save false
      waitForContent: true,
      testThumbnails: true,
      forceRefresh: true,
      includeRaw: true,
      log: true,
      timeout: 20000,
    }
  }, function(err, res, body) {
    var applinks = body.data
    t.assert(applinks.some(function(applink) {
      return ('website' === applink.type)
    }))
    cleanup(moksha, applinks, function(err) {
      test.done()
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
    t.get('/data/links?query[_from]=' + applink._id + '&query[_to]=' + place._id,
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
