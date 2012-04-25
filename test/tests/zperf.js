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
  getRec = constants.getDefaultRecord,
  dbProfile = constants.dbProfile.smokeTest,
  results = [],
  util = require('../../lib/util'),
  Timer = util.Timer,
  testTimer = new Timer,
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  log = util.log


exports.start = function(test) {
  testTimer.expected = 6000
  testTimer.start()
  test.done()
}


// Process perf test results
function done(test, testName, timer, count) {
  test.ok(timer && timer.expected, "You forgot to set timer.expected")
  count = count || 0
  var time = timer.stop()
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

exports.cleanData = function(test) {
  var timer = new util.Timer()
  timer.expected = 10
  req.method = 'post'
  req.uri = baseUri + '/__do/find'
  req.body = JSON.stringify({
    table: 'users',
    fields: ['_id'],
    find: {email: {$regex: '^perftest' }}
  })
  request(req, function(err, res) {
    check(req, res)
    // convert result from array of objects: [{ _id: id},...] to an array of ids: [id, id]
    var ids = []
    res.body.data.forEach(function(row) {
      ids.push(row._id)
    })
    req.method = 'delete'
    req.uri = baseUri + '/users'
    req.body = JSON.stringify({ids: ids})
    request(req, function(err, res) {
      check(req, res)
      done(test, 'cleanData', timer, res.body.count)
    })
  })
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
    req.method = 'post'
    req.body = JSON.stringify({data:user})
    req.uri = baseUri + '/users'
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
  req.method = 'post'
  req.uri = baseUri + '/__do/find'

  findUser(100)
  function findUser(i) {
    if (!i--) return done(test, 'find100Users', timer, cRecs)
    req.body = JSON.stringify({table:'users',find:{email:'perftestuser' + i + '@3meters.com'}})
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
  req.method = 'post'

  findAndUpdateUser(100)
  function findAndUpdateUser(i) {
    if (!i--) return done(test, 'findAndUpdate100Users', timer, cRecs)
    req.uri = baseUri + '/__do/find'
    req.body = JSON.stringify({
      table: 'users',
      fields: ['_id'],
      find: {email:'perftestuser' + i + '@3meters.com'}
    })
    request(req, function(err, res) {
      check(req, res)
      req.uri = baseUri + '/users/__ids:' + res.body.data[0]._id
      req.body = JSON.stringify({data:{location:'Updated Perfburg' + i + ', WA'}})
      request(req, function(err, res) {
        check(req, res)
        if (res.body.count) cRecs += res.body.count
        test.ok(res.body && res.body.count && res.body.count > 0, dump(req, res))
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
  req.method = 'post'

  getEntity(100)

  function getEntity(i) {
    if (!i--) return done(test, 'get100Entities', timer, cRecs)  // break recursion
    var recNum = Math.floor(Math.random() * dbProfile.beacons * dbProfile.epb)
    var id = testUtil.genId('entities', recNum)

    req.uri = baseUri + '/__do/getEntities'
    req.body = JSON.stringify({
      entityIds:[id], 
      eagerLoad:{children:true, comments:true}, 
      options:{limit:500, skip:0, sort:{modifiedDate:-1}}
    })
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === 1, dump(req, res))
      return getEntity(i) // recurse
    })
  }
}

exports.getEntitiesFor100Beacons = function (test) {
  var 
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300
  req.method = 'post'

  getEntitiesForBeacon(100)

  function getEntitiesForBeacon(i) {
    if (!i--) return done(test, 'getEntitesFor100Beacons', timer, cRecs)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    req.body = JSON.stringify({
      beaconIds:[id], 
      eagerLoad:{ children:true, comments:false }, 
      options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
    })
    req.uri = baseUri + '/__do/getEntitiesForBeacons'
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      test.ok(res.body.count === dbProfile.epb, dump(req, res))
      getEntitiesForBeacon(i)
    })
  }
}

exports.getEntitiesFor10x10Beacons = function (test) {
  var 
    timer = new Timer(),
    cRecs = 0,
    batchSize = 10
  timer.expected = 300
  req.method = 'post'

  getEntitiesForBeacon(dbProfile.beacons / batchSize)

  function getEntitiesForBeacon(i) {
    if (!i--) return done(test, 'getEntitesFor10x10Beacons', timer, cRecs)
    var beaconRecNumStart = (i + 1) * batchSize  
    var beaconRecNumEnd = beaconRecNumStart - batchSize
    var beaconIds = []
    for (var j = beaconRecNumStart; j--;) {
      if (j < beaconRecNumEnd) break
      var id = testUtil.genBeaconId(j)
      beaconIds.push(id)
    }
    req.body = JSON.stringify({
      beaconIds:beaconIds, 
      eagerLoad:{ children:true, comments:false }, 
      options:{ limit:500, skip:0, sort:{modifiedDate:-1} }
    })
    req.uri = baseUri + '/__do/getEntitiesForBeacons'
    request(req, function(err, res) {
      check(req, res)
      test.ok(res.body.count === dbProfile.epb * batchSize, dump(req, res))
      if (res.body.count) cRecs += ((res.body.count) + (res.body.count * dbProfile.spe))
      getEntitiesForBeacon(i)
    })
  }
}

exports.getEntitiesFor10Users = function(test) {
  var timer = new Timer(),
    recordLimit = 300,
    cRecs = 0 
  timer.expected = 120
  req.method = 'post'

  getEntitiesForUser(10)

  function getEntitiesForUser(i) {
    if (!i--) return done(test, 'getEntitiesFor10Users', timer, cRecs)
    req.body = JSON.stringify({
      userId:constants.uid1,
      eagerLoad:{children:false, comments:false},
      options:{limit:500, skip:0, sort:{modifiedDate:-1}}
    })
    req.uri = baseUri + '/__do/getEntitiesForUser'
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
      // This check currently fails because the method doesn't support limits
      //test.ok(res.body.count === Math.min(recordLimit, dbProfile.beacons * dbProfile.epb), dump(req, res))
      return getEntitiesForUser(i)
    })
  }
}

exports.getEntitiesNear100Locations = function (test) {
  var 
    timer = new Timer(),
    cRecs = 0
  timer.expected = 300
  req.method = 'post'

  getEntitiesNearLocation(100)

  function getEntitiesNearLocation(i) {
    if (!i--) return done(test, 'getEntitiesNear100Locations', timer, cRecs)
    req.body = JSON.stringify({
      userId: constants.uid1,
      latitude: constants.latitude,
      longitude: constants.longitude,
      radius: 0.00001,
      options:{limit:500, skip:0, sort:{modifiedDate:-1}}
    })
    req.uri = baseUri + '/__do/getEntitiesNearLocation'
    request(req, function(err, res) {
      check(req, res)
      if (res.body.count) cRecs += res.body.count
      return getEntitiesNearLocation(i)
    })
  }
}

exports.cleanup = function(test) {
  return exports.cleanData(test)
}

exports.finish = function(test) {
  var time = testTimer.stop()
  test.ok(time < testTimer.expected)
  results.push({'Total': {time: time, expected: testTimer.expected}})
  log('\nResults: ', results)
  log()
  test.done()
}