/**
 *  Proxibase facebook account kit authencation test
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var qs = require('querystring')
var t = testUtil.treq
var skip = testUtil.skip
var adminCred
var userCred
var adminId
var _exports = {}     // for commenting out tests


// This is a run-once test. Get a new value for this variable for each test run
// from the server logs after executing the first step of this process from a
// phone that has the Facebook Account Kit sdk running.  Awesome!
var akAuthCode = 'AQBD7GGwoy6YcVawK3l4xDtZS5wjHFLHV5C9egIfr6d7__EQOkRAMfp6Ksa5dWDVL8ahB93f3C4JfN3at_mrvR_Cac_0eEvX13nNyCbZAAktlwQBKXaRargj5J4RyZWNZ2VsWQwtQyv5zJCnylF61nXsBOo6ZIoauMRHJHKt23-YjoXgESU6zSWwFj0ZtXlORaLiNeLsVdbJiqPCCKuMcX0FXYkSjlzjdDYh1BCL_Bd-YeSIDE2xxVDM5JG8VV0OSaltd7G0taM6wGosIWqBKL1o'

var akUser
var installId = 'testAccountKitInstall'

exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session, admin, cred) {
    adminCred = qs.stringify(cred)
    adminId = session._owner
    test.done()
  })
}


exports.canRegisterDevice = function(test) {
  t.post({
    uri: '/do/registerInstall',
    body: {
      install: {
        installId: installId,
        parseInstallId: installId + 'Parse',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    },
  }, function(err, res, body) {
    t.assert(body.info)
    t.assert(body.count)

    // Confirm that install doc looks ok
    t.get('/find/installs/in.' + installId + '?' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._user === util.anonId)
      t.assert(body.data.installId === installId)
      t.assert(body.data.parseInstallId === installId + 'Parse')
      test.done()
    })
  })
}

exports.userCanSignInWithAccountKit = function(test) {
  t.post({
    uri: '/auth/ak',
    body: {
      authorization_code: akAuthCode,
      install: installId,
      log: true,
    },
  }, function(err, res, body) {
    t.assert(body.user)
    akUser = body.user
    t.assert(akUser._id)
    t.assert(akUser.akid)
    t.assert(akUser.role && akUser.role === 'provisional')
    t.assert(!akUser.name)
    akUser.cred = qs.stringify(body.credentials)
    t.assert(akUser.cred)
    test.done()
  })
}


exports.canReadPublicSignedIn = function(test) {
  t.get({
    uri: '/data/patches?' + akUser.cred
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === akUser._id)
    t.assert(body.data && body.data.length)
    test.done()
  })
}


exports.provisionalUserCannotCreateContent = function(test) {
  t.post({
    uri: '/data/patches?' + akUser.cred,
    body: {data: {name: 'Test patch from provisional user should fail'}}
  }, 401, function() {
    test.done()
  })
}


exports.upgradeProvisionalUser = function(test) {
  t.post({
    uri: '/data/users/' + akUser._id + '?' + akUser.cred,
    body: {data: {role: 'admin'}},
  }, 401, function() {
    t.post({
      uri: '/data/users/' + akUser._id + '?' + akUser.cred,
      body: {data: {role: 'user'}},
    }, 400, function() {
      t.post({
        uri: '/data/users/' + akUser._id + '?' + akUser.cred,
        body: {data: {role: 'user', name: 'Willy Nelson'}},
      }, function(err, res, body) {
        var user = body.data
        t.assert(user && user._id)
        t.assert(user.role === 'user')
        t.assert(user.name === 'Willy Nelson')
        test.done()
      })
    })
  })
}


exports.userCanSignOut = function(test) {
  t.get('/auth/signout?' + akUser.cred,
  function(err, res, body) {
    t.get('/data/users?' + akUser.cred, 401,
    function(err, res, body) {

      // Confirm session deleted
      t.get('/data/sessions?q[_owner]=' + akUser._id + '&' + adminCred,
      function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}
