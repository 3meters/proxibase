/**
 *  Anonymous user tests
 */

var util = require('proxutils')
var statics = util.statics
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq

var adminCred
var testLatitude = 46.1
var testLongitude = -121.1
var installId1 = '5905d547-8321-4612-abe2-00001'
var beaconId1 = 'be.44:44:44:44:44:44'
var beaconId2 = 'be.55:55:55:55:55:55'
var beaconId3 = 'be.66:66:66:66:66:66'
var _exports = {}  // For commenting out tests

exports.getSessions = function (test) {
  testUtil.getAdminSession(function(session) {
    adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}

exports.registerInstallOne = function (test) {
  t.post({
    uri: '/do/registerInstall',
    body: {
      install: {
        parseInstallId: 'registration_id_testing_user_anonymous',
        installId: installId1,
        clientVersionCode: 100,
        clientVersionName: '1.0.0',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)
    test.done()
  })
}

exports.getPatchesUsingProximity = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity',
    body: {
      installId: installId1,
      cursor: { skip: 0, limit: 50, sort: { modifiedDate: -1 }},
      links: { shortcuts: false,
         active:
          [ { schema: 'beacon', limit: 10, links: true, type: 'proximity', count: true, direction: 'both' },
            { schema: 'message', limit: 2, links: true, type: 'content', count: true, direction: 'both' }]
      },
      beaconIds: [
        beaconId1,
        beaconId2,
      ],
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)
    test.done()
  })
}

exports.getPatchesUsingLocation = function (test) {
  /*
   * Call should succeed but will not return any patches if run stand-alone
   */
  t.post({
    uri: '/patches/near',
    body: {
      location: {
        lat: testLatitude,
        lng: testLongitude,
        altitude: 12,
        accuracy: 30,
        geometry: [testLongitude, testLatitude]
      },
      limit: 50,
      radius: 10000,
      installId: installId1,
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)
    test.done()
  })
}

// We decided to cut this feature on 12/15/15, so now it returns a 401
exports.updateProximity = function (test) {
  t.post({
    uri: '/do/updateProximity',
    body: {
      beaconIds: [ beaconId3 ],
      installId: installId1,
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}
