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
var skip = testUtil.skip
var disconnected = testUtil.disconnected
var adminCred
var adminId
var userCred
var user
var _exports = {}                    // for commenting out tests

var validationDate
var seed = util.seed(5)
var parseInstallId = 'parse_install_' + seed
var installId


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session, savedUser, cred) {
    userSession = session
    userCred = qs.stringify(cred)
    user = savedUser
    installId = cred.install
    testUtil.getAdminSession(function(session, admin, cred) {
      adminSession = session
      adminCred = qs.stringify(cred)
      adminId = session._owner
      test.done()
    })
  })
}


exports.confirmOnlyOneUserSession = function(test) {
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
      t.assert(body.data.installId === installId)
      t.assert(body.data.parseInstallId === parseInstallId)
      t.assert(body.data.users && body.data.users.length === 1)
      t.assert(body.data.users[0] === user._id)
      test.done()
    })
  })
}


exports.updateInstall = function(test) {
  t.get('/?' + userCred + '&ll=47.534,-122.17' +
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
    test.done()
  })
}


exports.bogusInstallIdOnCredentialsDoesNotError = function(test) {
  t.get('/?' + userCred + '&install=bogusInstallId&ll=50,-124',
  function(err, res, body) {
    t.assert(!body.install)   // not an error, res.installId is undefined
    test.done()
  })
}


exports.signoutClearsInstallRecordUser = function(test) {
  t.get('/data/installs/in.' + installId + '?' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._user === user._id)
    t.assert(body.data.users && body.data.users.length && body.data.users.indexOf(user._id >= 0))

    t.get('/auth/signout?' + userCred,
    function(err, res, body) {
      t.get('/data/users?' + userCred, 401,
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
      password: 'foobar',
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

      // Deprecated 2016.06.08
      // t.assert(body.data.users && body.data.users.indexOf(user2._id) >= 0)

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

  if (disconnected) return skip(test)

  var branchUrl

  // Test passing in bogus email
  t.post({
    uri: '/user/pw/reqreset',
    // the test and secret params are for tests only of a public unsecured api
    // Do not copy those into client code:  it is gaping security hole
    body: {email: 'bogus', test: true, secret: 'adaandherman'}
  }, 401, function(err, res, body) {
    t.assert(body.error && body.error.code === 401.4)  // email not found
    t.post({
      uri: '/user/pw/reqreset',
      // the test and secret params are for tests only of a public unsecured api
      // Do not copy those into client code:  it is gaping security hole
      body: {email: user.email, test: true, secret: 'adaandherman'}
    }, function(err, res, body) {
      t.assert(body && body.sent)
      t.assert(body.user && body.user._id && body.user.name)
      t.assert(body.token)
      t.assert(body.branchUrl)
      t.assert(body.email)

      branchUrl = body.branchUrl

      // Now reset the password, but pass in a bogus token, this will generate
      // a badAuth error, which is the same result the caller will get if passing
      // in a valid but expired token.  Expiration window is statics.passwordResetWindow.
      var token = body.token
      var savedUser = body.user
      t.post({
        uri: '/user/pw/reset',
        body: {
          password: 'doodah',
          token: 'bogus',
          test: true,
        }
      }, 401, function(err, res, body) {
        t.assert(body.error && body.error.code === 401.1)  // bad credentials, same as invalid password

        // Reset the password with a valid token
        t.post({
          uri: '/user/pw/reset',
          body: {
            password: 'doodah',
            token: token,
            test: true,
          }
        }, function(err, res, body) {
          // confirm that user is signed in
          t.assert(body && body.user && body.session && body.credentials)

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

            // Try to reset the password again with the same token
            // Tokens are one-time use only so it should fail with 
            // a bad auth error
            t.post({
              uri: '/user/pw/reset',
              body: {
                password: 'doodah2',
                token: token,
                test: true,
              }
            }, 401, function(err, res, body) {
              t.assert(body.error && body.error.code === 401.1)
              test.done()
            })
          })
        })
      })
    })
  })
}


exports.canKillBadInstalls = function(test) {
  t.post({
    uri: '/do/registerInstall?' + userCred,
    body: {
      install: {
        clientPackageName: "com.aircandi.catalina",
        clientVersionCode: 120,
      }
    }
  }, function(err, res, body) {
    t.assert(util.tipe.isString(body.count))  // Should crash the client

    t.post({
      uri: '/do/registerInstall?' + userCred,
      body: {
        install: {
          clientPackageName: "com.patchr.android",
          clientVersionCode: 214,
        }
      }
    }, function(err, res, body) {
      t.assert(util.tipe.isString(body.count))  // Should crash the client

      t.post({
        uri: '/do/registerInstall?' + userCred,
        body: {
          install: {
            installId: 'testid',
            clientPackageName: "com.patchr.android",
            clientVersionCode: 215,
          }
        }
      }, function(err, res, body) {
        t.assert(util.tipe.isNumber(body.count))  // Should pass through the client
        test.done()
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
