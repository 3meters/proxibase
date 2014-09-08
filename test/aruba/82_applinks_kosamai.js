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
      var lastValidatedDate = 0
      applinks.forEach(function(applink) {
        appMap[applink.type] = appMap[applink.type] || 0
        appMap[applink.type]++
        // Track the most recent validation date for validated applinks.
        // When get save is called again, all validated applinks should
        // have validated value greater than this number.
        if (applink.validatedDate) {
          if (applink.validatedDate > lastValidatedDate) {
            lastValidatedDate = applink.validatedDate
          }
        }
        if ('googleplus' === applink.type) {
          t.assert(applink.appId)
          t.assert(applink.name && 'googleplus' !== applink.name)
        }
      })
      t.assert(util.tipe.isUndefined(appMap.factual))
      t.assert(appMap.website === 1)
      t.assert(appMap.foursquare === 1)
      t.assert(appMap.twitter === 1)
      t.assert(appMap.facebook === 1)
      log('Skipping googleplus')
      // t.assert(appMap.googleplus === 1)

      // add a bogus applink manually to ensure that a subsequent get / save will delete it
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
          uri: '/data/links?' + adminCred,
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
          t.post({
            uri: '/applinks/get?' + userCred,
            body: {
              placeId: place._id,
              save: true,
              includeRaw: true,
              timeout: 20000,
            }
          }, function(err, res, body) {
            var applinks = body.data
            var ws, fb, fs, yl
            t.assert(applinks && applinks.length)
            applinks.forEach(function(applink) {
              switch (applink.type) {
                case 'website':
                  ws = true
                  t.assert(!fb)
                  t.assert(!fs)
                  t.assert(!yl)
                  break

                case 'facebook':
                  fb = true
                  t.assert(ws)
                  t.assert(!fs)
                  t.assert(!yl)
                  break

                case 'foursquare':
                  fs = true
                  t.assert(ws)
                  t.assert(fb)
                  t.assert(!yl)
                  break

                case 'yelp':
                  yl = true
                  t.assert(ws)
                  t.assert(fb)
                  t.assert(fs)
                  break
              }
            })
            t.assert(yl)
            // Issue 164: test refresh applinks wait for content
            t.post({
              uri: '/applinks/get?' + userCred,
              body: {
                placeId: place._id,
                save: false,
                waitForContent: true,
                testThumbnails: false,
                forceRefresh: true,
                includeRaw: true,
                log: true,
                timeout: 20000,
              }
            }, function(err, res, body) {
              t.assert(body.data.some(function(applink) {
                return ('website' === applink.type)
              }))
              cleanup(place, applinks, function(err) {
                test.done()
              })
            })
          })
        })
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
