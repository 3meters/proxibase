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

exports.badMajorVersionFailsProperly = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/?version=0.9.5'
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.4, dump(req, res)) // badVersion
    test.done()
  })
}

exports.badMinorVersionFailsProperly = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/?version=1.1.5'
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.4) // badVersion
    test.done()
  })
}

exports.upgradeVersionHintWorks = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/?version=1.2.0'
  })
  request(req, function(err, res) {
    check(req, res)  // success
    assert(res.body.upgrade === true) //
    test.done()
  })
}

exports.currentVersionSuccedesQuietly = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/?version=1.2.3'
  })
  request(req, function(err, res) {
    assert((typeof res.body.upgrade === 'undefined'))
    test.done()
  })
}

exports.futureVersionSuccedesQuietly = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/?version=1.2.9'
  })
  request(req, function(err, res) {
    check(req, res)  // success
    assert((typeof res.body.upgrade === 'undefined'))
    test.done()
  })
}

//
// Tests updating the version doc through the database then 
// updating the server's cached client version id via 
// get /client?refresh=true
//
exports.canRefreshVersionViaDatabaseAndRefreshParam = function(test) {
  var req = new Req({
    uri: '/data/documents/' + util.statics.clientVersion._id + '?' + adminCred,
    body: {
      data: {
        data: {
          updateUri: updateUri,
          version: '2.3.4'
        }
      }
    }
  })
  request(req, function(err, res) {
    check(req, res)
    req = new Req({
      method: 'get',
      uri: '/'
    })
    request(req, function(err, res) {
      check(req, res)
      assert(res.body.clientVersion === '1.2.3', dump(req, res))  // not refreshed
      req = new Req({
        method: 'get',
        uri: '/client?refresh=true'
      })
      request(req, function(err, res) {
        check(req, res)
        assert(res.body.data.version === '2.3.4', dump(req, res))
        req = new Req({
          method: 'get',
          uri: '/'
        })
        request(req, function(err, res) {
          check(req, res)
          assert(res.body.clientVersion === '2.3.4', dump(req, res)) // global config var has been refreshed
          test.done()
        })
      })
    })
  })
}
