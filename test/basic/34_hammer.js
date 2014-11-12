/**
 * test/hammer.js
 *    performance and stress test
 *
 *    Since these are run in parallel there can be no module-scoped
 *    variable data.
 */

var util = require('proxutils')
var statics = util.statics
var constants = require('../constants')
var log = util.log
var seed = util.seed
var serviceUri = util.config.service.uri
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var testLatitude2 = 47.1
var testLongitude2 = -122.1
var radiusTiny = 0.000001
var radiusBig = 10000


exports.runHammer = function(test) {
  var user
  var userCred
  var admin = util.adminUser
  var adminCred
  var userTom
  var userTomCred
  var installId1 = '5905d547-8321-4612-abe1-' + seed(5)
  var installId2 = '5905d547-8321-4612-abe1-' + seed(5)
  var installId3 = '5905d547-8321-4612-abe1-' + seed(5)
  var bssid1Seed = seed(2) + ':' + seed(2) + ':' + seed(2)
  var bssid1 = 'be.11:11:11:' + bssid1Seed
  var testBeacon1 = {
    _id : 'be.' + bssid1,
    schema : util.statics.schemaBeacon,
    name: 'Test Beacon ' + bssid1Seed,
    ssid: 'Test Beacon ' + bssid1Seed,
    bssid: bssid1,
    signal: -80,
    location: {
      lat:testLatitude,
      lng:testLongitude,
      altitude:12,
      accuracy:30,
      geometry:[testLongitude, testLatitude]
    },
  }

  getSessions()

  function getSessions() {
    testUtil.getUserSession(function(session, sessionUser) {
      user = sessionUser
      userCred = 'user=' + session._owner + '&session=' + session.key
      testUtil.getAdminSession(function(session) {
        adminCred = 'user=' + session._owner + '&session=' + session.key
        testUtil.getUserSession(function(session, user) {
          userTom = user
          userTomCred = 'user=' + session._owner + '&session=' + session.key
          getEnts()
        })
      })
    })
  }

  function getEnts() {
    t.post({
      uri: '/do/getEntities?' + userCred,
      body: {
        entityIds: [constants.patchId],
        links: {
          active: [
            { type:statics.typeProximity, schema:statics.schemaBeacon, links: true, count: true, direction: 'both' }, 
            { type:statics.typeContent, schema:statics.schemaApplink, links: true, count: true, direction: 'both' }, 
            { type:statics.typeContent, schema:statics.schemaComment, links: true, count: true, direction: 'both' }, 
            { type:statics.typeContent, schema:statics.schemaPost, links: true, count: true, direction: 'both' }, 
            { type:statics.typeWatch, schema:statics.schemaUser, links: true, count: true, direction: 'both' }, 
            { type:statics.typeLike, schema:statics.schemaUser, links: true, count: true, direction: 'both' }, 
          ]
        },
      }
    }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        var record = body.data[0]
        t.assert(record.linksIn && record.linksIn.length)
        // t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + dbProfile.watch)
        t.assert(record.linksOut && record.linksOut.length === 1)
        t.assert(record.linksInCounts && record.linksInCounts.length === 4)
        t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
        getEntsLinkedByUser()
    })
  }

  function getEntsLinkedByUser() {
    t.post({
      uri: '/do/getEntities?' + userCred,
      body: {
        entityIds: [constants.patchId], 
        links: {
          loadWhere: { _creator: constants.uid1 },
          active: [ 
            { type:statics.typeProximity, schema:statics.schemaBeacon }, 
            { type:statics.typeContent, schema:statics.schemaApplink }, 
            { type:statics.typeContent, schema:statics.schemaComment, links: true, count: false }, 
            { type:statics.typeContent, schema:statics.schemaPost, links: true, count: false }, 
            { type:statics.typeWatch, schema:statics.schemaUser }, 
            { type:statics.typeLike, schema:statics.schemaUser }, 
          ]},
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      var record = body.data[0]
      getEntsForBeacon()
    })
  }

  function getEntsForBeacon() {
    t.post({
      uri: '/do/getEntities?' + userCred,
      body: {
        entityIds: [constants.beaconId],
        links: {
          active: [ 
            { type:statics.typeProximity, schema:statics.schemaPatch, links: true, count: true }, 
          ]},
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      var record = body.data[0]
      // t.assert(record.linksIn && record.linksIn.length === dbProfile.epb)
      t.assert(record.linksInCounts && record.linksInCounts.length === 1)
      t.assert(body.date)
      getEntsForUser()
    })
  }

  function getEntsForUser() {
    /*
     * We don't currently populate the smoke test data with any entities that have
     * both a parent and children.
     */
    t.post({
      uri: '/do/getEntities?' + adminCred,
      body: {
        entityIds: [constants.uid1],
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      var record = body.data[0]
      t.assert(!record.linksIn && !record.linksOut)
      t.assert(!record.linkInCounts && !record.linkOutCounts)
      t.assert(!record.entities && !record.users)
      registerInstall()
    })
  }

  function registerInstall() {
    var registrationId = 'registration_id_tom_'// + util.seed()
    t.post({
      uri: '/do/registerInstall?' + userTomCred,
      body: {
        install: {
          registrationId: registrationId,
          installId: installId1,
          clientVersionCode: 10,
          clientVersionName: '0.8.12'
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)  // may be an insert or an update since we run many times

      /* Check register install */
      t.post({
        uri: '/find/installs?' + adminCred,
        body: {
          query: { installId: installId1 }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert('in.' + installId1 == body.data[0]._id)  // proves custom genId works
        t.assert(body.data[0].installId)
        t.assert(body.data[0].registrationId)
        t.assert(body.data[0].registrationId === registrationId)
        t.assert(body.data[0].users && body.data[0].users.length >= 1)
        t.assert(body.data[0].signinDate)
        updateBeaconsForInstall()
      })
    })
  }

  function updateBeaconsForInstall() {
    t.post({
      uri: '/do/getEntitiesByProximity?' + userTomCred,
      body: {
        beaconIds: [testBeacon1._id],
        installId: installId1
      }
    }, function(err, res, body) {
      t.assert(body.data && body.data.length == 0)

      /* Check install beacons */
      t.post({
        uri: '/find/installs?' + adminCred,
        body: {
          query: { installId: installId1 }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert(body.data[0].beacons.length === 1)
        t.assert(body.data[0].beaconsDate)
        test.done()
      })
    })
  }

  function finish() {
    test.done()
  }

}
