/**
 *  Proxibase reset password test
 *
 */

var util = require('proxutils')
var qs = require('querystring')
var request = require('request')
var assert = require('assert')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var disconnected = testUtil.disconnected
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

    // Confirm that install doc looks ok
    t.get('/find/installs/in.' + installId + '?' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._user === user._id)
      t.assert(body.data.users && body.data.users.length === 1)
      t.assert(body.data.users[0] === user._id)
      test.done()
    })
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
  t.get('/data/installs/in.' + installId + '?' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._user === user._id)
    t.assert(body.data.users && body.data.users.length && body.data.users.indexOf(user._id >= 0))

    t.get('/auth/signout?' + newUserCred,
    function(err, res, body) {
      t.get('/data/users?' + newUserCred, 401,
      function(err, res, body) {

        // Confirm install record no longer has _user field set, but user._id is still in users array
        t.get('/data/installs/in.' + installId + '?' + adminCred,
        function(err, res, body) {
          t.assert(body.data)
          t.assert(body.data._user !== user._id)
          t.assert(body.data.users && body.data.users.length && body.data.users.indexOf(user._id >= 0))
          test.done()
        })
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
    t.get('/data/installs/in.' +  installId + '?' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._user === user._id)
      t.assert(body.data.users && body.data.users.length)
      t.assert(body.data.users.some(function(userId) { return userId === user._id }))
      test.done()
    })
  })
}


exports.createUserUpdatesInstall = function(test) {
  var user2 = {
    email: 'user2install@3meters.com',
    name: 'User2 Install',
    photo: {prefix: 'authTestUser.jpg', source:"aircandi.images"},
    password: 'foobar',
  }

  t.post({
    uri: '/user/create',
    body: {
      data: user2,
      secret: 'larissa',
      installId: installId,
    }
  }, function(err, res, body) {
    t.assert(body.user && body.session && body.credentials && body.install)
    user2 = body.user
    user2.cred = qs.stringify(body.credentials)

    t.get('/data/installs/in.' + installId + '?' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._user === user2._id)
      t.assert(body.data.users && body.data.users.indexOf(user2._id) >= 0)

      // Delete user 2
      t.del({
        uri: '/user/' + user2._id + '?' + user2.cred,
      }, function(err, res, body) {
        test.done()
      })
    })
  })
}


exports.resetPasswordByEmail = function(test) {

  var branchUrl

  t.post({
    uri: '/user/pw/reqreset',
    body: {email: user.email, test: true, secret: 'adaandherman'}   // public unsecured api, security hole
  }, function(err, res, body) {
    t.assert(body && body.sent)
    t.assert(body.user && body.user._id && body.user.name)
    t.assert(body.token)
    t.assert(body.branchUrl)
    t.assert(body.email)

    branchUrl = body.branchUrl

    // Now reset the password using the token
    var token = body.token
    var savedUser = body.user
    t.post({
      uri: '/user/pw/reset',
      body: {
        password: 'doodah',
        token: token,
        test: true,
      }
    }, function(err, res, body) {
      t.assert(body && body.reset === 1)

      // Confirm the password was reset
      t.post({
        uri: '/auth/signin',
        body: {
          email: user.email,
          password: 'doodah',
        }
      }, function(err, res, body) {

        if (disconnected) return skip(test)

        var branchKey = util.statics.apiKeys.branch.test
        var testUrl = 'https://api.branch.io/v1/url?url=' + branchUrl +
            '&branch_key=' + branchKey
        request.get(testUrl, function(err, res, body) {
          assert(!err)
          assert(util.tipe.isString(body), body)
          var branchBody = JSON.parse(body)
          assert(branchBody.data, body)
          assert(branchBody.data.token, body)
          assert(branchBody.data.userName, body)
          assert(branchBody.data.userPhoto, body)
          test.done()
        })
      })
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
