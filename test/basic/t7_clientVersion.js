/*
 *  Proxibase client version tests
 */

var util = require('utils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
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
  t.get('/client', function(err, res, body) {
    t.assert(body.data.version === '0.0.0')
    test.done()
  })
}

exports.setVersionRequiresAuth = function(test) {
  t.post({
    uri: '/client',
    body: { data: {
        updateUri: updateUri,
        version: '5.2.0'
      } } }, 401,
  function(err, res, body) {
    test.done()
  })
}

exports.setVersionRequiresAdmin = function(test) {
  t.post({
    uri: '/client?' + userCred,
    body: {
      data: {
        updateUri: updateUri,
        version: '5.2.0'
      }
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.canSetVersion = function(test) {
  t.post({
    uri: '/client?' + adminCred,
    body: {
      data: {
        updateUri: updateUri,
        version: '1.2.3'
      }
    }
  }, function(err, res, body) {
    t.get('/', function(err, res2, body) {
      t.assert(body.clientVersion === '1.2.3')
      test.done()
    })
  })
}

exports.badMajorVersionFailsProperly = function(test) {
  t.get('/?version=0.9.5', 400, function(err, res, body) {
    t.assert(body.error.code === 400.4) // badVersion
    test.done()
  })
}

exports.badMinorVersionFailsProperly = function(test) {
  t.get('/?version=1.1.5', 400, function(err, res, body) {
    t.assert(body.error.code === 400.4) // badVersion
    test.done()
  })
}

exports.upgradeVersionHintWorks = function(test) {
  t.get('/?version=1.2.0', function(err, res, body) {
    t.assert(body.upgrade === true) //
    test.done()
  })
}

exports.currentVersionSuccedesQuietly = function(test) {
  t.get('/?version=1.2.3', function(err, res, body) {
    t.assert(util.type.isUndefined(body.upgrade))
    test.done()
  })
}

exports.futureVersionSuccedesQuietly = function(test) {
  t.get('/?version=1.2.9', function(err, res, body) {
    t.assert(util.type.isUndefined(body.upgrade))
    test.done()
  })
}

//
// Tests updating the version doc through the database then 
// updating the server's cached client version id via 
// get /client?refresh=true
//
exports.canRefreshVersionViaDatabaseAndRefreshParam = function(test) {
  t.post({
    uri: '/data/documents/' + util.statics.clientVersion._id + '?' + adminCred,
    body: {
      data: {
        data: {
          updateUri: updateUri,
          version: '2.3.4'
        }
      }
    }
  }, function(err, res, body) {
    t.get('/', function(err, res, body) {
      t.assert(body.clientVersion === '1.2.3')  // not refreshed
      t.get('/client?refresh=true', function(err, res, body) {
        t.assert(body.data.version === '2.3.4')
        t.get('/', function(err, res, body) {
          t.assert(body.clientVersion === '2.3.4') // global config var has been refreshed
          test.done()
        })
      })
    })
  })
}
