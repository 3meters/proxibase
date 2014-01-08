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
var installId = '567'
var registrationId = '890'
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

exports.oneUserSession = function(test) {
  t.get('/data/sessions?query[_owner]=' + user._id + '&' + adminCred,
  function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}


exports.canRegisterDevice = function(test) {
  t.post({
    uri: '/do/registerInstall?' + userCred,
    body: {
      install: {
        installId: installId,
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
      installId: 'wrongId',
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
      installId: installId,
    }
  }, function(err, res, body) {
    t.assert(body.session)
    newUserCred = 'user=' + user._id + '&session=' + body.session.key
    t.assert(util.now() + (30*60*1000) >= body.session.expirationDate)
    test.done()
  })
}

exports.requestPasswordResetDoesntLeakSessions = function(test) {
  t.get('/data/sessions?query[_owner]=' + user._id + '&query[_install]=in.' + installId + '&' + adminCred,
  function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}

exports.userRoleIsSetToReset = function(test) {
  t.get('/data/users/' + user._id + '?' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
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

exports.userWithResetRoleCanExecuteResetPassword = function(test) {
  t.post({
    uri: '/user/resetpw?' + newUserCred,
    body: {
      password: 'newpass',
      installId: installId,
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert('user' === body.user.role)
    t.assert(body.session)
    t.assert(body.session.expirationDate >= (util.now() + (24*60*60*1000)))
    t.post({
      uri: '/auth/signin',
      body: {
        email: user.email,
        password: 'newpass',
        installId: installId,
      }
    }, function(err, res, body) {
      test.done()
    })
  })
}

exports.resetPasswordDoesntLeakSessions = function(test) {
  t.get('/data/sessions?query[_owner]=' + user._id + '&query[_install]=in.' + installId + '&' + adminCred,
  function(err, res, body) {
    t.assert(1 === body.count)
    test.done()
  })
}

exports.cleanup = function(test) {
  t.delete({
    uri: '/data/users/' + user._id + '?' + adminCred,
  }, function(err, res, body) {
    test.done()
  })
}
