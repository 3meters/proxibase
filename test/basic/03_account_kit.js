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
var seed = util.seed()
var adminCred
var userCred
var adminId
var _exports = {}     // for commenting out tests


// Facebook hasn't exposed a way to test the authorization_code flow.  This test is skipped
var akAuthCode = 'AQAURFZwTY821qQUOpwfmpKM5b4bWWaj_IeJSGHTYz3EZcGinI3yT9HNDxuOAsxNcKs_wiRPYUKIgTbW4Tn4mvMNtyXoERMMIEbvpSlepmgsZ-qLFydIGvyXzqL9s-8i2JzLsQb6BsahuBqRoiqUjFCtz8HeLWJajPXzVWj-uaOjz2uOhVbAh3d5F9QVik8dIR2oZrKOYpO1NGSypV8Pniw4zCfzUYTKUgi9RHwAt1vkCyU50uxDJqbC8koSPIzFvtjHHiGXWiGuXWlaMXFSVxGh'

// Long lived access token which matches 3meters phone number, (425) 780-7885
var akAccessTokenPhone = 'EMAWf4pZAV81diNU7KzxllFJa5rVNZCQ7gTR4c8Ec1lxUqIJrOZBDMTPZBm3x6KKnIZB1XpCQ6RLWD7JGW95m9fklvO0NZBEhzt56KFufSk4V8eNdMDRpZCu8bAS4HcSbGLrK1tcCOERJsgco2ll4XddErmolFqschC8ZD'

var akAccessTokenEmail = 'EMAWfUT2aP0BoIotZC3tZCX1vGRUDdZAg6YAX6s2VX0lZCTZBz5ZBLcfj4ZA7NKVzN1WviBBdK9LZA7z5lGYkckxZCoEyzjdaCMr0JzGpgFb042agm0OZAoCuSd0SxZAGuy8nyxeey4VDIzkkTxSNDkF5KQMJn7FR4f2BqAPCVQ2U7zyoxpzAgK7D80yJdzrTnII6fyAZD'

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

exports.userCanGetAccountKitAuthCode = function(test) {
  return skip(test)
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


exports.userCanSignInWithAccountKitPhone = function(test) {
  t.post({
    uri: '/auth/ak/test',
    body: {
      access_token: akAccessTokenPhone,
      install: installId,
      log: true,
    },
  }, function(err, res, body) {
    t.assert(body.user)
    akUser = body.user
    t.assert(akUser._id)
    t.assert(akUser.akid)
    t.assert(!akUser.email)
    t.assert(akUser.phone && akUser.phone.number && akUser.phone.countryCode)
    t.assert(!akUser.name)
    t.assert(!akUser.validationNotifyDate)  // Issue #418: ak has validated the user so we don't have to
    t.assert(akUser.role && akUser.role === 'provisional')
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


exports.usersCanTransitionFromLocalAuthToAKAuth = function(test) {
  var user = {
    email: 'testak@3meters.com',
    name: 'testAccountKitEmailUser',
    photo: {prefix: 'akTestUser.jpg', source:"aircandi.images"},
    password: 'doodahak',
  }

  t.post({
    uri: '/user/create',
    body: {
      data: user,
      secret: 'larissa',
      installId: installId,
    }
  }, function(err, res, body) {
    akUser = body.user
    t.assert(akUser._id)
    t.assert(akUser.email === 'testak@3meters.com')
    t.assert(akUser.role === 'user')
    test.done()
  })
}


// The access token in this test shares the email address from the previous test
exports.userCanSignInWithAccountKitEmail = function(test) {
  t.post({
    uri: '/auth/ak/test',
    body: {
      access_token: akAccessTokenEmail,  // testak@3meters.com
      install: installId,
      log: true,
    },
  }, function(err, res, body) {
    t.assert(body.user)
    akUser = body.user
    t.assert(akUser._id)
    t.assert(akUser.akid)
    t.assert(akUser.email === 'testak@3meters.com')
    t.assert(!akUser.phone)
    t.assert(akUser.name)
    t.assert(akUser.role && akUser.role === 'user') // not provisional becuase user has a name
    akUser.cred = qs.stringify(body.credentials)
    t.assert(akUser.cred)
    test.done()
  })
}
