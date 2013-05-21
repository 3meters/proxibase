/**
 *  Proxibase stats basic test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var userSession
var userCred
var adminSession
var adminCred
var oldUserCount
var testLatitude = 46.1
var testLongitude = -121.1
var testEntity = {
  name: "StatsTest Entity 1",
  type: util.statics.typeContent,
  enabled : true
}
var testBeacon = {
  label: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '11:11:11:11:11:11',
  beaconType: 'fixed',
  visibility: 'public',
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 12,
  accuracy : 30,
  level: -80,
  loc : [testLongitude, testLatitude]
}
var testObservation = {
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 100,
  accuracy : 50.0
}
var testStartTime = util.now()
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}

exports.statsWelcomeWorks = function(test) {
  t.get({
    uri: '/stats'
  }, function(err, res, body) {
    test.done()
  })
}

exports.badStatName404s = function(test){
  t.get({
    uri: '/stats/usersByEntityyyy' + adminCred
  }, 404, function(err, res, body) {
    test.done()
  })
}


exports.statsCollectionStartsEmpty = function(test){
  t.get({
    uri: '/stats/usersByEntity'
  }, function(err, res, body){
    t.assert(body.data)
    t.assert(!body.data.length)
    test.done()
  })
}


exports.cannotCreateStatsAsUser = function(test) {
  t.get({
    uri: '/stats/usersByEntity?refresh=true&' + userCred
  }, 401, function(err, res, body){
    test.done()
  })
}

exports.adminCanRefreshStat = function(test) {
  t.get({
    uri: '/stats/usersByEntity?refresh=true&' + adminCred
  }, function(err, res, body){
    t.assert(body.data.length)
    oldUserCount = body.data.length
    test.done()
  })
}

// Add a new Entity by a new user, then update the statistics and ensure
// that his new contribution appears in the stat
exports.staticsUpdateOnRefresh = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity,
      beacons:[testBeacon],
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0]._id)
    t.get({
      uri: '/stats/usersByEntity?refresh=true&' + adminCred
    }, function(err, res2, body){
      t.assert(body.data.length)
      t.assert(body.data.length === (oldUserCount + 1))
      test.done()
    })
  })
}

exports.statsPassThroughFindCriteria = function(test) {
  t.get({
    uri: '/stats/usersByEntity?find={"_id":"' + userSession._owner + '"}'
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    test.done()
  })
}

exports.statsLookupsWork = function(test) {
  t.get({
    uri: '/stats/usersByEntity?find={"_id":"' + userSession._owner + '"}&lookups=true'
  }, function(err, res, body) {
    t.assert(body.data[0].name === 'Test User')
    test.done()
  })
}

exports.statsWorkFromDoFind = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      stat: 'usersByEntity',
      ids: [userSession._owner]
    }
  }, function(err, res, body) {
    t.assert(body.data[0]._id === userSession._owner)
    test.done()
  })
}

exports.statsWorkFromDoFindWithRefresh = function(test) {
  t.post({
    uri: '/do/find?' + adminCred,
    body: {
      stat: 'usersByEntity',
      ids: [userSession._owner],
      refresh: true
    }
  }, function(err, res, body) {
    t.assert(body.data[0]._id === userSession._owner)
    test.done()
  })
}

exports.statsFromDoFindFailRefreshAsUser = function(test) {
  t.post({
    uri: '/do/find?' + userCred,
    body: {
      stat: 'usersByEntity',
      ids: [userSession._owner],
      refresh: true
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.statsFailProperlyFromDoFind = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      stat: 'usersByEntityBogus',
      ids: [userSession._owner]
    }
  }, 404, function(err, res, body) {
    test.done()
  })
}
