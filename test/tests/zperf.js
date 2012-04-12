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
  testTimer.expected = 300
  testTimer.start()
  test.done()
}

function done(test, testName, timer) {
  assert(timer.expected, "You forgot to set timer.expected")
  var time = timer.stop()
  assert(time < timer.expected, 'Performance test ' + testName +
    ' failed.  Time: ' + time + ', expected: ' + timer.expected)
  results.push({test: testName, time: time, expected: timer.expected})
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
      done(test, 'cleanData', timer)
    })
  })
}

exports.insert100Users = function(test) {
  var
    timer = new util.Timer(),
    user = getRec('users')

  timer.expected = 3
  delete user._id
  delete user.createdDate
  delete user.modifiedDate
  delete user.owner

  insertUser(100)
  function insertUser(i) {
    if (!i--) return done(test, 'insert100Users', timer)
    user.name = 'Perf Test User ' + i
    user.email = 'perftestuser' + i + '@3meters.com'
    req.method = 'post'
    req.body = JSON.stringify({data:user})
    req.uri = baseUri + '/users'
    request(req, function(err, res) {
      check(req, res)
      return insertUser(i)
    })
  }
}

exports.find100Users = function(test) {
  var timer = new Timer()
  timer.expected = 3
  req.method = 'post'
  req.uri = baseUri + '/__do/find'

  findUser(100)
  function findUser(i) {
    if (!i--) return done(test, 'find100Users', timer)
    req.body = JSON.stringify({table:'users',find:{email:'perftestuser' + i + '@3meters.com'}})
    request(req, function(err, res) {
      check(req, res)
      return findUser(i)
    })
  }
}

exports.findAndUpdate100Users = function(test) {
  var timer = new Timer()
  timer.expected = 8
  req.method = 'post'

  findAndUpdateUser(100)
  function findAndUpdateUser(i) {
    if (!i--) return done(test, 'findAndUpdate100Users', timer)
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
        assert(res.body && res.body.count && res.body.count > 0, dump(req, res))
        return findAndUpdateUser(i)
      })
    })
  }
}


exports.get100Entities = function (test) {
  var timer = new Timer()
  timer.expected = 10
  req.method = 'post'

  getEntity(100)

  function getEntity(i) {
    if (!i--) return done(test, 'get100Entities', timer)  // break recursion
    var recNum = Math.floor(Math.random() * dbProfile.beacons * dbProfile.epb)
    var id = testUtil.genId('entities', recNum)

    req.uri = baseUri + '/__do/getEntities'
    req.body = JSON.stringify({entityIds:[id],eagerLoad:{children:true,comments:true}})
    request(req, function(err, res) {
      check(req, res)
      assert(res.body.count === 1, dump(req, res))
      return getEntity(i) // recurse
    })
  }
}

exports.getEntitiesFor100Beacons = function (test) {
  var timer = new Timer()
  timer.expected = 10
  req.method = 'post'

  getEntitiesForBeacon(100)

  function getEntitiesForBeacon(i) {
    if (!i--) return done(test, 'getEntitesFor100Beacons', timer)
    var recNum = Math.floor(Math.random() * dbProfile.beacons)
    var id = testUtil.genBeaconId(recNum)
    req.body = JSON.stringify({beaconIds:[id],eagerLoad:{children:true,comments:false}})
    req.uri = baseUri + '/__do/getEntitiesForBeacons'
    request(req, function(err, res) {
      check(req, res)
      assert(res.body.count === dbProfile.epb, dump(req, res))
      getEntitiesForBeacon(i)
    })
  }
}

exports.getEntitiesFor100Users = function(test) {
  var timer = new Timer(),
    recordLimit = 100
  timer.expected = 120
  req.method = 'post'

  getEntitiesForUser(100)

  function getEntitiesForUser(i) {
    if (!i--) return done(test, 'getEntitiesFor100Users', timer)
    req.body = JSON.stringify({
      userId:constants.uid1,
      eagerLoad:{children:false,comments:false},
      limit: recordLimit})  // this line has no effect -- limit is not a supported param in the custom methods
    req.uri = baseUri + '/__do/getEntitiesForUser'
    request(req, function(err, res) {
      check(req, res)
      // This check currently fails because the method doesn't support limits
      // assert(res.body.count === Math.min(recordLimit, dbProfile.beacons * dbProfile.epb), dump(req, res))
      return getEntitiesForUser(i)
    })
  }
}

exports.getEntitiesNear100Locations = function (test) {
  var timer = new Timer()
  timer.expected = 120
  req.method = 'post'

  getEntitiesNearLocation(100)

  function getEntitiesNearLocation(i) {
    if (!i--) return done(test, 'getEntitiesNear100Locations', timer)
    req.body = JSON.stringify({
      userId: constants.uid1,
      latitude: constants.latitude,
      longitude: constants.longitude,
      radius: 0.00001
    })
    req.uri = baseUri + '/__do/getEntitiesNearLocation'
    request(req, function(err, res) {
      check(req, res)
      return getEntitiesNearLocation(i)
    })
  }
}

exports.cleanup = function(test) {
  return exports.cleanData(test)
}

exports.finish = function(test) {
  var time = testTimer.stop()
  assert(time < testTimer.expected)
  results.push({'Total': {time: time, expected: testTimer.expected}})
  log('\nResults: ', results)
  log()
  test.done()
}

