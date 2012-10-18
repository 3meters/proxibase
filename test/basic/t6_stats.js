/*
 *  Proxibase stats basic test
 */

var
  assert = require('assert'),
  request = require('request'),
  util = require('util'),
  log = util.log,
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  userSession,
  userCred,
  adminSession,
  adminCred,
  oldUserCount,
  testEntity = {
    name: "StatsTest Entity 1",
    type: "com.aircandi.candi.picture",
    enabled : true,
    root: true
  },
  testBeacon = {
    _id : '0003:11:11:11:11:11:11'  // left over by the methods test
  }
  testStartTime = util.getTimeUTC(),
  _exports = {}  // For commenting out tests


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
  var req = new Req({
    method: 'get',
    uri: '/stats'
  })
  request(req, function(err, res){
    check(req, res)
    test.done()
  })
}

exports.badStatName404s = function(test){
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntityyyy' + adminCred
  })
  request(req, function(err, res){
    check(req, res, 404)
    test.done()
  })
}


exports.statsCollectionStartsEmpty = function(test){
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntity'
  })
  request(req, function(err, res){
    check(req, res)
    assert(res.body.data)
    assert(!res.body.data.length)
    test.done()
  })
}


exports.cannotCreateStatsAsUser = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntity?refresh=true&' + userCred
  })
  request(req, function(err, res){
    check(req, res, 401)
    test.done()
  })
}

exports.adminCanRefreshStat = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntity?refresh=true&' + adminCred
  })
  request(req, function(err, res){
    check(req, res)
    assert(res.body.data.length)
    oldUserCount = res.body.data.length
    test.done()
  })
}

// Add a new Entity by a new user, then update the statistics and ensure
// that his new contribution appears in the stat
exports.staticsUpdateOnRefresh = function(test) {
  var req = new Req({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity,
      beacon:testBeacon,
      link: {_to:testBeacon._id}
    }
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    var req2 = new Req({
      method: 'get',
      uri: '/stats/usersByEntity?refresh=true&' + adminCred
    })
    request(req2, function(err, res2){
      check(req2, res2)
      assert(res2.body.data.length)
      if (res2.body.data.length !== (oldUserCount + 1)) {
        log('did not pick up test user \n' +  dump(req2, res2))
      }
      test.done()
    })
  })
}

exports.statsPassThroughFindCriteria = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntity?find={"_id":"' + userSession._owner + '"}'
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.length === 1, dump(req, res))
    test.done()
  })
}

exports.statsLookupsWork = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/stats/usersByEntity?find={"_id":"' + userSession._owner + '"}&lookups=true'
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data[0].name === 'Test User')
    test.done()
  })
}

exports.statsWorkFromDoFind = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {
      stat: 'usersByEntity',
      ids: [userSession._owner]
    }
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data[0]._id === userSession._owner, dump(req, res))
    test.done()
  })
}
