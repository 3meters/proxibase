/*
 *  Proxibase perf test
 *
 *  These tests do not check the accuracy of the results of queries. They only
 *    check that queries do not throw errors and that they finish in less than
 *    the expected time.
 */

var

  request = require('request'),
  testUtil = require('../util'),
  constants = require('../constants'),
  userCred = '',
  adminCred = '',
  getRec = constants.getDefaultRecord,
  dbProfile = constants.dbProfile.smokeTest,
  results = [],
  util = require('util'),
  Timer = util.Timer,
  testTimer = new Timer,
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  log = util.log
  _exports = {} // for commenting out tests


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
  var
    timer = new util.Timer(),
    user = getRec('users'),
    cRecs = 0

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
    var req = new Req({
      uri: '/user/create',
      body: {data: user, noValidate: true, secret: 'larissa'},
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
      return insertUser(i)
    })
  }
}

exports.find100Users = function(test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 60

  findUser(100)
  function findUser(i) {
    if (!i--) return done(test, 'find100Users', timer, cRecs)
    var req = new Req({
      uri: '/do/find',
      body: {table: 'users', find: {email: 'perftestuser' + i + '@3meters.com'}}
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
      return findUser(i)
    })
  }
}

exports.findAndUpdate100Users = function(test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 120

  findAndUpdateUser(100)
  function findAndUpdateUser(i) {
    if (!i--) return done(test, 'findAndUpdate100Users', timer, cRecs)
    var req = new Req({
      uri: '/do/find',
      body: {
        table: 'users',
        fields: ['_id'],
        find: {email:'perftestuser' + i + '@3meters.com'}
      }
    })
    request(req, function(err, res) {
      check(req, res)
      var req2 = new Req({
        uri: '/data/users/' + res.body.data[0]._id + '?' + adminCred,
        body: {data:{location:'Updated Perfburg' + i + ', WA'}}
      })
      request(req2, function(err, res) {
        check(req2, res)
        if (res.body.count) cRecs += res.body.count
        test.ok(res.body && res.body.count && res.body.count > 0, dump(req2, res))
        return findAndUpdateUser(i)
      })
    })
  }
}


exports.get100Entities = function (test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getEntity(100)

  function getEntity(i) {
    if (!i--) return done(test, 'get100Entities', timer, cRecs)  // break recursion
    var recNum = Math.floor(Math.random() * dbProfile.beacons * dbProfile.epb)
    var id = testUtil.genId('entities', recNum)

    var req = new Req({
      uri: '/do/getEntities',
      body: {
        entityIds:[id],
        eagerLoad:{children:true, comments:true},
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === 1, dump(req, res))
      return getEntity(i) // recurse
    })
  }
}

exports.getEntitiesForLocation100Beacons = function (test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesForLocation100Beacons', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    var req = new Req({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:[id],
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === dbProfile.epb, dump(req, res))
      getEntitiesForLocation(i)
    })
  }
}

exports.getEntitiesForLocation10x10Beacons = function (test) {
  var 
    timer = new Timer(),
    cRecs = 0,
    batchSize = 10
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
    var req = new Req({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:beaconIds, 
        eagerLoad:{ children:true, comments:false }, 
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    })
    request(req, function(err, res) {
      check(req, res)
      test.ok(res.body.count === dbProfile.epb * batchSize, dump(req, res))
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      getEntitiesForLocation(i)
    })
  }
}

_exports.getEntitiesByLocationOnly = function (test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesByLocationOnly', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    var req = new Req({
      uri: '/do/getEntitiesForLocation',
      body: {
        observation: { accuracy:20, latitude:47.5935851, longitude:-122.1596039 },
        radius: 0.00006314726,
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === dbProfile.epb, dump(req, res))
      getEntitiesForLocation(i)
    })
  }
}

_exports.getEntitiesByLocationWithBeaconUpgrade = function (test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getEntitiesForLocation(i) {
    if (!i--) return done(test, 'getEntitiesByLocationWithBeaconUpgrade', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    var req = new Req({
      uri: '/do/getEntitiesForLocation',
      body: {
        beaconIdsNew:beaconIds, 
        observation: { accuracy:20, latitude:47.5935851, longitude:-122.1596039 },
        radius: 0.00006314726,
        eagerLoad:{ children:true, comments:false },
        options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === dbProfile.epb, dump(req, res))
      getEntitiesForLocation(i)
    })
  }
}

_exports.getUsers = function (test) {
  var
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getEntitiesForLocation(100)

  function getUsers(i) {
    if (!i--) return done(test, 'getUsers', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    var req = new Req({
      uri: '/do/getUser',
      body: {
        userId:'xxxxxxxxxxxxxxxxxx'
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === dbProfile.epb, dump(req, res))
      getUsers(i)
    })
  }
}


exports.getEntitiesFor10Users = function(test) {
  var timer = new Timer(),
    recordLimit = 300,
    cRecs = 0 
  timer.expected = 120

  getEntitiesForUser(10)

  function getEntitiesForUser(i) {
    if (!i--) return done(test, 'getEntitiesFor10Users', timer, cRecs)
    var req = new Req({
      uri: '/do/getEntitiesForUser',
      body: {
        userId:constants.uid1,
        eagerLoad:{children:false, comments:false},
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
      // This check currently fails because the method doesn't support limits
      //test.ok(res.body.count === Math.min(recordLimit, dbProfile.beacons * dbProfile.epb), dump(req, res))
      return getEntitiesForUser(i)
    })
  }
}

// Makes an external call -- not appropriate for perf test
_exports.getPlacesNear100Locations = function (test) {
  var 
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300

  getPlacesNearLocation(100)

  function getPlacesNearLocation(i) {
    if (!i--) return done(test, 'getPlacesNear100Locations', timer, cRecs)
    var req = new Req({
      uri: '/do/getPlacesNearLocation',
      body: {
        userId: constants.uid1,
        latitude: constants.latitude,
        longitude: constants.longitude,
        radius: 0.00001,
        source: 'foursquare',
        placesWithUriOnly: true,
        options:{limit:500, skip:0, sort:{modifiedDate:-1}}
      }
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
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
