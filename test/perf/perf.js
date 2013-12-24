/**
 *  Proxibase perf test
 *
 *  These tests do not check the accuracy of the results of queries. They only
 *    check that queries do not throw errors and that they finish in less than
 *    the expected time.
 *
 *  We use test.ok in some cases instead of t.assert because test.ok will not
 *    abort the test on failure.
 */

var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var userCred = ''
var adminCred = ''
var getRec = constants.getDefaultRecord
var dbProfile = constants.dbProfile.smokeTest
var results = []
var util = require('proxutils')
var timer = util.timer
var testTimer = timer()
var log = util.log
var _exports = {} // for commenting out tests


// Process perf test results
function done(test, testName, timer, count) {
  test.ok(timer && timer.expected, "You forgot to set timer.expected")
  count = count || 0
  var time = timer.read()
  var recsPerSecond = (Math.round(1000 * count / time) / 1000)
  test.ok(time < timer.expected, 'Performance test ' + testName +
    ' failed.  Time: ' + time + ', Expected: ' + timer.expected)
  if (recsPerSecond) {
    test.ok(recsPerSecond > 10, 'Performance test ' + testName + 
      ' failed.  RecsPerSecond:  ' + recsPerSecond + ', Expected: ' + 10)
  }
  results.push({
    test: testName,
    time: time,
    expected: timer.expected,
    count: count,
    recsPerSecond: recsPerSecond
    })
  test.done()
}

// Get user session and store the credentials in a module global
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

// Start timer
exports.start = function(test) {
  testTimer.expected = 6000
  testTimer.start()
  test.done()
}


exports.insert100Users = function(test) {
  var timer = timer()
  var user = getRec('users')
  var cRecs = 0

  timer.expected = 60
  delete user._id
  delete user.createdDate
  delete user.modifiedDate
  delete user.owner

  insertUser(100)
  function insertUser(i) {
    if (!i--) return done(test, 'insert100Users', timer, cRecs)
    user.name = 'Perf Test User ' + i
    user.email = 'perftestuser' + i + '@3meters.com'
    user.password = 'foobar'
    t.post({
      uri: '/user/create',
      body: {data: user, secret: 'larissa'},
    }, function(err, res, body) {
      if (body.count) cRecs += body.count
      return insertUser(i)
    })
  }
}

exports.find100Users = function(test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 60

  findUser(100)
  function findUser(i) {
    if (!i--) return done(test, 'find100Users', timer, cRecs)
    t.post({
      uri: '/do/find',
      body: {table: 'users', find: {email: 'perftestuser' + i + '@3meters.com'}}
    }, function(err, res, body) {
      if (body.count) cRecs += body.count
      return findUser(i)
    })
  }
}

exports.findAndUpdate100Users = function(test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 120

  findAndUpdateUser(100)
  function findAndUpdateUser(i) {
    if (!i--) return done(test, 'findAndUpdate100Users', timer, cRecs)
    t.post({
      uri: '/do/find',
      body: {
        table: 'users',
        fields: ['_id'],
        find: {email:'perftestuser' + i + '@3meters.com'}
      }
    }, function(err, res, body) {
      t.post({
        uri: '/data/users/' + body.data[0]._id + '?' + adminCred,
        body: {data:{location:'Updated Perfburg' + i + ', WA'}}
      }, function(err, res, body) {
        if (body.count) cRecs += body.count
        test.ok(body && body.count && body.count > 0)
        return findAndUpdateUser(i)
      })
    })
  }
}


exports.get100Entities = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getEntity(100)

  function getEntity(i) {
    if (!i--) return done(test, 'get100Entities', timer, cRecs)  // break recursion
    var recNum = Math.floor(Math.random() * dbProfile.beacons * dbProfile.epb)
    var id = testUtil.genId('entities', recNum)

    t.post({
      uri: '/do/getEntities',
      body: {
        entityIds:[id],
        eagerLoad:{children:true, comments:true},
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    }, function(err, res, body) {
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      test.ok(body.count === 1)
      return getEntity(i) // recurse
    })
  }
}

exports.getEntitiesForLocation100Beacons = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesForLocation100Beacons', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    t.post({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:[id],
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    }, function(err, res, body) {
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      test.ok(body.count === dbProfile.epb)
      getEntitiesForLocation(i)
    })
  }
}

exports.getEntitiesForLocation10x10Beacons = function (test) {
  var timer = timer()
  var cRecs = 0
  var batchSize = 10
  timer.expected = 300

  getEntitiesForLocation(dbProfile.beacons / batchSize)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesForLocation10x10Beacons', timer, cRecs)
    var beaconRecNumStart = (i + 1) * batchSize  
    var beaconRecNumEnd = beaconRecNumStart - batchSize
    var beaconIds = []
    for (var j = beaconRecNumStart; j--;) {
      if (j < beaconRecNumEnd) break
      var id = testUtil.genBeaconId(j)
      beaconIds.push(id)
    }
    t.post({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:beaconIds, 
        eagerLoad:{ children:true, comments:false }, 
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    }, function(err, res, body) {
      test.ok(body.count === dbProfile.epb * batchSize)
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      getEntitiesForLocation(i)
    })
  }
}

_exports.getEntitiesByLocationOnly = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesByLocationOnly', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    t.post({
      uri: '/do/getEntitiesForLocation',
      body: {
        observation: { accuracy:20, latitude:47.5935851, longitude:-122.1596039 },
        radius: 0.00006314726,
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    }, function(err, res, body) {
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      test.ok(body.count === dbProfile.epb)
      getEntitiesForLocation(i)
    })
  }
}

_exports.getEntitiesByLocationWithBeaconUpgrade = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesByLocationWithBeaconUpgrade', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    t.post({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:beaconIds, 
        observation: { accuracy:20, latitude:47.5935851, longitude:-122.1596039 },
        radius: 0.00006314726,
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    }, function(err, res, body) {
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      test.ok(body.count === dbProfile.epb)
      getEntitiesForLocation(i)
    })
  }
}

_exports.getUsers = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getUsers(i) {
    if (!i--) return done(test, 'getUsers', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    t.post({
      uri: '/do/getUser',
      body: {
        userId:'xxxxxxxxxxxxxxxxxx'
      }
    }, function(err, res, body) {
      if (body.count) cRecs += ((body.count) + (body.count * dbProfile.spe))
      test.ok(body.count === dbProfile.epb)
      getUsers(i)
    })
  }
}


exports.getEntitiesFor10Users = function(test) {
  var timer = timer()
  var recordLimit = 300
  var cRecs = 0
  timer.expected = 120

  getEntitiesForUser(10)

  function getEntitiesForUser(i) {
    if (!i--) return done(test, 'getEntitiesFor10Users', timer, cRecs)
    t.post({
      uri: '/do/getEntitiesForUser',
      body: {
        userId:constants.uid1,
        eagerLoad:{children:false, comments:false},
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    }, function(err, res, body) {
      if (body.count) cRecs += body.count
      // This check currently fails because the method doesn't support limits
      //test.ok(body.count === Math.min(recordLimit, dbProfile.beacons * dbProfile.epb))
      return getEntitiesForUser(i)
    })
  }
}

// Makes an external call -- not appropriate for perf test
_exports.getPlacesNear100Locations = function (test) {
  var timer = timer()
  var cRecs = 0
  timer.expected = 300

  getPlacesNearLocation(100)

  function getPlacesNearLocation(i) {
    if (!i--) return done(test, 'getPlacesNear100Locations', timer, cRecs)
    t.post({
      uri: '/places/getNearLocation',
      body: {
        userId: constants.uid1,
        latitude: constants.latitude,
        longitude: constants.longitude,
        radius: 0.00001,
        source: 'foursquare',
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    }, function(err, res, body) {
      if (body.count) cRecs += body.count
      return getPlacesNearLocation(i)
    })
  }
}

exports.insert10Entities = function(test) {
  log('nyi')
  test.done()
}

exports.insert100ChildEntities = function(test) {
  log('nyi')
  test.done()
}

exports.insert100Comments = function(test) {
  log('nyi')
  test.done()
}

exports.finish = function(test) {
  var time = testTimer.read()
  test.ok(time < testTimer.expected)
  results.push({'Total': {time: time, expected: testTimer.expected}})
  log('\nResults: ', results)
  log()
  test.done()
}
