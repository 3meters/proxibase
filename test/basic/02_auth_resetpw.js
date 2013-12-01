/**
 *  Proxibase reset password test
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var adminCred
var adminId
var userCred
var user
var _exports = {}                    // for commenting out tests

var validationDate
var installationId = 'fakeInstallId'
var registrationId = 'fakeRegId'
var newUserCred

exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    userId = session._owner
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
      adminId = session._owner
      t.get('/data/users/' + userId + '?' + userCred,
      function(err, res, body) {
        t.assert(body.data)
        user = body.data
        test.done()
      })
    })
  })
}


exports.canRegisterDevice = function(test) {
  t.post({
    uri: '/do/registerInstall?' + userCred,
    body: {
      install: {
        installationId: installationId,
        registrationId: registrationId,
        _user: userId
      }
    },
  }, function(err, res, body) {
    t.assert(body.info)
    t.assert(body.count)
    test.done()
  })
}

exports.requestPasswordResetFailsWithWrongId = function(test) {
  t.post({
    uri: '/user/reqresetpw',
    body: {
      email: user.email,
      installationId: 'wrongId',
    }
  }, 401, function(err, res, body) {
    t.assert(401 === body.error.code)
    test.done()
  })
}

exports.requestPasswordReset = function(test) {
  t.post({
    uri: '/user/reqresetpw',
    body: {
      email: user.email,
      installationId: installationId,
    }
  }, function(err, res, body) {
    t.assert(body.session)
    newUserCred = 'user=' + user._id + '&session=' + body.session.key
    t.assert(util.now() + (30*60*1000) >= body.session.expirationDate)
    test.done()
  })
}

exports.userRoleIsSetToReset = function(test) {
  t.get('/data/users/' + user._id + '?' + adminCred,
  function(err, res, body) {
    t.assert('reset' === body.data.role)
    test.done()
  })
}

exports.oldSessionKilledAfterResetRequest = function(test) {
  t.get('/data/users/' + user._id + '?' + userCred,
  401, function(err, res, body) {
    t.assert(401 === body.error.code)
    test.done()
  })
}

exports.usersWithResetRoleCannotExecuteRegularCalls = function(test) {
  t.get('/data/users/' + user._id + '?' + newUserCred,
  401, function(err, res, body) {
    test.done()
  })
}

_exports.userWithResetRoleCanExecuteResetPassword = function(test) {
  t.post({
    uri: '/user/resetpw?' + newUserCred,
    body: {
      password: 'newpass'
    }
  }, 501, function(err, res, body) {
    // implement
    test.done()
  })
}

exports.cleanup = function(test) {
  t.post({
    uri: '/data/users/' + user._id + '?' + adminCred,
    body: {
      data: {
        role: 'user'
      }
    }
  }, function(err, res, body) {
    test.done()
  })
}
