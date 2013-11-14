/**
 *  Proxibase applink refresh test
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


//  https://foursquare.com/v/kaosamai/4a3d9c80f964a52088a21fe3
exports.refreshKaosamai = function(test) {

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
      t.assert(appMap.facebook === 1)

      // add a bogus applink manually to ensure that a subsequent refresh will delete it
      t.post({
        uri: '/data/applinks?' + userCred,
        body: {
          data: {
            type: 'facebook',
            appId: 'aBogusFaceBookId',
          }
        }
      }, 201, function(err, res, body) {
        var bogusApplinkId = body.data._id
        t.assert(bogusApplinkId)
        t.post({
          uri: '/data/links?' + userCred,
          body: {
            data: {
              _to: place._id,
              _from: bogusApplinkId,
              type: 'content',
            }
          }
        }, 201, function(err, res, body) {
          var bogusLinkId = body.data._id
          t.assert(bogusLinkId)
          cleanup(place, applinks)
        })
      })
    })
  })

  // return the db to a clean state.  twould be nice if the test harness did
  // this automatically between test files.  
  function cleanup(place, applinks) {

    async.eachSeries(applinks, removeApplink, function(err) {
      t.assert(!err)
      t.delete({uri: '/data/places/' + place._id + '?' + adminCred}, function(err, res, body) {
        t.assert(1 === body.count)
        test.done()
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
}
