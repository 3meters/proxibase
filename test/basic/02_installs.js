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
var parseInstallId = '890'
var newUserCred


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session, savedUser) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    user = savedUser
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
      adminId = session._owner
      t.get('/data/users/' + user._id + '?' + userCred,
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
        parseInstallId: parseInstallId,
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    },
  }, function(err, res, body) {
    t.assert(body.info)
    t.assert(body.count)
    test.done()
  })
}

exports.updateInstall = function(test) {
  t.get('/?' + userCred + '&install=' + installId + '&ll=47.534,-122.17' +
      '&beacons[0]=be.01:02:03:04:05:06&beacons[1]=be.02:02:03:04:05:06',
  function(err, res, body) {
    t.assert(body.install)
    t.assert(body.install.installId === installId)
    t.assert(body.install._id === 'in.' + installId)
    t.assert(body.install.location)
    t.assert(body.install.location.lat === 47.534)
    t.assert(body.install.location.lng === -122.17)
    t.assert(body.install.beacons)
    t.assert(body.install.beacons.length === 2)
    t.assert(body.install.beacons[0] === 'be.01:02:03:04:05:06')
    t.get('/?' + userCred + '&install=bogusInstallId&ll=50,-124',
    function(err, res, body) {
      t.assert(!body.install)   // not an error, res.installId is undefined
      test.done()
    })
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

exports.signingInAfterResetPasswordRequestRestoresRoleToUser = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {
      email: user.email,
      password: 'foobar',
      installId: installId,
    }
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user)
    t.assert(body.user.role === 'user')
    // request password reset again
    t.post({
      uri: '/user/reqresetpw',
      body: {
        email: user.email,
        installId: installId,
      },
    }, function(err, res, body) {
      t.assert(body.session)
      t.assert(body.user)
      t.assert(body.user.role === 'reset')
      newUserCred = 'user=' + user._id + '&session=' + body.session.key
      test.done()
    })
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

      // Confirm install record is tied to user
      t.get('/data/installs?q[_user]=' + user._id + '&' + adminCred,
      function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
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


exports.signinOutClearsInstallRecordUser = function(test) {
  t.get('/auth/signout?' + newUserCred,
  function(err, res, body) {
    t.get('/data/users?' + newUserCred, 401,
    function(err, res, body) {

      // Confirm install record no longer has _user field set
      t.get('/data/installs?q[_user]=' + user._id + '&' + adminCred,
      function(err, res, body) {
        t.assert(body.count === 0)  // gone
        test.done()
      })
    })
  })
}


exports.signinResetsInstallRecordUser = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {
      email: user.email,
      password: 'newpass',
      installId: installId,
    }
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user)
    // Confirm install record has the _user field reset
    t.get('/data/installs?q[_user]=' + user._id + '&' + adminCred,
    function(err, res, body) {
      t.assert(body.count === 1)  // gone
      test.done()
    })
  })
}


exports.cleanup = function(test) {
  t.delete({
    uri: '/data/users/' + user._id + '?erase=1&' + adminCred,
  }, function(err, res, body) {
    test.done()
  })
}
