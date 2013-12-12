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

// get version info and also make sure the server is responding
exports.getVersion = function(test) {
  t.get('/client', function(err, res, body) {
    t.assert(body.data.androidMinimumVersion === 0)
    test.done()
  })
}

exports.setVersionRequiresAuth = function(test) {
  t.post({
    uri: '/client',
    body: {data: {androidMinimumVersion: 1}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.setVersionRequiresAdmin = function(test) {
  t.post({
    uri: '/client?' + userCred,
    body: {data: {androidMinimumVersion: 1}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.canSetVersionAsAdmin = function(test) {
  t.post({
    uri: '/client?' + adminCred,
    body: {data: {androidMinimumVersion: 1}}
  }, function(err, res, body) {
    t.assert(body.data.androidMinimumVersion === 1)
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
    uri: '/data/documents/' + util.statics.clientVersion._id + '?' + adminCred,
    body: {
      data: {
        data: {
          androidMinimumVersion: 2
        }
      }
    }
  }, function(err, res, body) {
    t.get('/', function(err, res, body) {
      t.assert(body.androidMinimumVersion === 1)  // not refreshed
      t.get('/client', function(err, res, body) {
        t.assert(body.data.androidMinimumVersion === 2) // refreshed
        test.done()
      })
    })
  })
}
