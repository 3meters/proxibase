/*
 *  Proxibase client version tests
 */

var assert = require('assert')
var request = require('request')
var util = require('util')
var log = util.log
var testUtil = require('../util')
var Req = testUtil.Req
var check = testUtil.check
var dump = testUtil.dump
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCred
var adminCred
var staticVersion = util.statics.clientVersion
var updateUri = staticVersion.updateUri
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
  var req = new Req({
    method: 'get',
    uri: '/client'
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.version === '0.0.0', dump(req, res))
    test.done()
  })
}

exports.setVersionRequiresAuth = function(test) {
  var req = new Req({
    uri: '/client',
    body: {
      data: {
        updateUri: updateUri,
        version: '5.2.0'
      }
    }
  })
  request(req, function(err, res) {
    check(req, res, 401) // requires admin
    test.done()
  })
}

exports.setVersionRequiresAdmin = function(test) {
  var req = new Req({
    uri: '/client?' + userCred,
    body: {
      data: {
        updateUri: updateUri,
        version: '5.2.0'
      }
    }
  })
  request(req, function(err, res) {
    check(req, res, 401) // requires admin
    test.done()
  })
}

exports.canSetVersion = function(test) {
   var req = new Req({
    uri: '/client?' + adminCred,
    body: {
      data: {
        updateUri: updateUri,
        version: '1.2.3'
      }
    }
  })
  request(req, function(err, res) {
    check(req, res) // requires admin
    var req2 = new Req({
      method: 'get',
      uri: '/'
    })
    request(req2, function(err, res2) {
      check(req2, res2)
      assert(res2.body.clientVersion === '1.2.3', dump(req2, res2))
      test.done()
    })
  })
}

exports.canRefreshVersionUpdatedViaDatabase = function(test) {
  log('nyi')
  test.done()
}

exports.badVersionFailsProperly = function(test) {
  log('nyi')
  test.done()
}

exports.upgradeVersionHintWorks = function(test) {
  log('nyi')
  test.done()
}

