/*
 *  Proxibase client version tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCred
var adminCred
var staticVersion = util.statics.clientVersion
var _exports = {} // for commenting out tests

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

// Check main signiture
exports.allResponsesIncludeClientMinVersion = function(test) {
  t.get('/', function(err, res, body) {
    t.assert(body.data)
    t.assert(1 === body.clientMinVersions['com.aircandi.aruba'])
    t.assert(1 === body.clientMinVersions['com.aircandi.catalina'])
    test.done()
  })
}

// get version info and also make sure the server is responding
exports.getVersion = function(test) {
  t.get('/client', function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data)
    t.assert(body.data['com_aircandi_aruba'] === 1)
    t.assert(body.data['com_aircandi_catalina'] === 1)
    test.done()
  })
}

exports.setVersionRequiresAuth = function(test) {
  t.post({
    uri: '/client',
    body: {data: {
      'com_aircandi_aruba': 95,
      'com_aircandi_catalina': 100,
    }},
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.setVersionRequiresAdmin = function(test) {
  t.post({
    uri: '/client?' + userCred,
    body: {data: {
      'com_aircandi_aruba': 95,
      'com_aircandi_catalina': 100,
    }},
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.canSetVersionAsAdmin = function(test) {
  t.post({
    uri: '/client?' + adminCred,
    body: {data: {
      'com_aircandi_aruba': 95,
      'com_aircandi_catalina': 99,
    }},
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(95 === body.data['com_aircandi_aruba'])
    t.assert(99 === body.data['com_aircandi_catalina'])
    test.done()
  })
}


//
// Tests updating the version doc through the database then 
// updating the server's cached client version id via 
// get /client
//
exports.canRefreshVersionViaDatabaseAndGetOnClient = function(test) {
  t.post({
    uri: '/data/sysvars/sy.clientMinVersions?' + adminCred,
    body: {data: {data: {
      'com_aircandi_aruba': 96,
      'com_aircandi_catalina': 100,
    }}},
  }, function(err, res, body) {
    t.get('/', function(err, res, body) {
      t.assert(body.data)
      // not refreshed
      t.assert(95 === body.clientMinVersions['com.aircandi.aruba'])
      t.assert(99 === body.clientMinVersions['com.aircandi.catalina'])
      t.get('/client?refresh=true', function(err, res, body) {
        // refreshed
        t.assert(96 === body.clientMinVersions['com.aircandi.aruba'])
        t.assert(100 === body.clientMinVersions['com.aircandi.catalina'])
        test.done()
      })
    })
  })
}
