/**
 *  Proxibase basic authencation test
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var adminCred
var userCred
var userOldCred
var session = {}
var adminSession = {}
var _exports = {}                    // for commenting out tests
var qs = require('qs')
var seed = String(Math.floor(Math.random() * 1000000))
var testUser = {
  name: 'AuthTestUser',
  type: 'user',
  email: 'authtest' + seed + '@3meters.com',
  password: 'foobar',
  photo: {prefix: 'authTestUser.jpg'},
}
var newUserId
var newUserEmail
var newUserEmailValidateUrl
var notifyDate
var validationDate


exports.cannotAddUserWhenNotSignedIn = function(test) {
  t.post({
    uri: '/data/users',
    body: {data: {email: 'foo@bar.com', password: 'foobarfoo'}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.canSignInAsAdmin = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'admin', password: 'admin', installId: '123456'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    t.assert(body.credentials)
    adminSession = body.session
    // These credentials will be useds in subsequent tests
    adminCred = qs.stringify(body.credentials)
    test.done()
  })
}

exports.cannotSignInAsAnonymous = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'anonymous', password: 'anonymous', installId: '123456'}
  }, 401, function(err, res, body) {
    t.assert(401.1 === body.error.code)
    test.done()
  })
}

exports.adminCannotAddUserWithoutEmail = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {user: {name: 'bob', password: 'foobar'},
        secret: 'larissa', installId: '123456'}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.adminCannotAddUserWithoutPassword = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: {email: seed + 'foo@bar.com'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.adminCanAddUserViaRest = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  }, 201, function(err, res, body) {
    var user = body.data
    t.assert(user)
    t.assert(user._id)
    t.assert(user.email === testUser.email)
    t.assert(user.validationNotifyDate)
    t.assert(user.role)
    t.assert(user.role === 'user')
    notifyDate = user.validationNotifyDate
    t.assert(!user.validationDate)
    testUser._id = user._id
    test.done()
  })
}


exports.adminCannotAddUserWithDupeEmail = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {data: testUser, secret: 'larissa', installId: '123456'}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.1)
    test.done()
  })
}

exports.userCannotSignInWithWrongFields = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {name: 'Not a user', password: 'password', installId: '123456'}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.userCannotSignInWithBadEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'billy@notHere', password: 'wrong', installId: '123456'}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.4) // email address not found
    test.done()
  })
}

exports.userCannotSignInWithBadPassword = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email, password: 'wrong', installId: '123456'}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)  // bad credentials
    test.done()
  })
}

exports.userCanSignIn = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email, password: testUser.password, installId: '123456'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    t.assert(body.user.email)
    t.assert(body.user.role && body.user.role === 'user')
    t.assert(body.session)
    session = body.session
    userCred = 'user=' + body.session._owner + '&session=' + body.session.key
    userCred = qs.stringify(body.credentials)
    test.done()
  })
}

exports.userCanSignInWithDifferentCasedEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email.toUpperCase(), password: testUser.password, installId: '123456'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    t.assert(body.user.email)
    t.assert(body.session)
    test.done()
  })
}

exports.cannotValidateSessionWithBogusUser = function(test) {
  t.get({
    uri: '/data/users?user=bogus&session=' + session.key
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)
    test.done()
  })
}

exports.cannotValidateSessionWithBogusKey = function(test) {
  t.get({
    uri: '/data/users?user=' + session._owner + '&session=bogus'
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)
    test.done()
  })
}

exports.canValidateSession = function(test) {
  t.get({
    uri: '/data/patches?user=' + session._owner + '&session=' + session.key
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}

exports.canValidateSessionUsingParamsInQuery = function(test) {
  t.get('/find/patches?user=' + session._owner + '&session=' + session.key,
  function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}

exports.canValidateSessionUsingParamsInBody = function(test) {
  t.post({
    uri: '/find/patches',
    body: {user: session._owner, session: session.key}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}

exports.sessionParamsInQueryStringOverrideOnesInBody = function(test) {
  t.post({
    uri: '/find/patches?user=' + session._owner + '&session=' + session.key,
    body: {user: util.adminUser._id, session: session.key}
  }, function(err, res, body) {
    t.post({
      uri: '/find/patches?user=' + util.adminUser._id + '&session=' + session.key,
      body: {user: session._owner, session: session.key}
    }, 401, function(err, res, body) {
      test.done()
    })
  })
}

exports.adminCannotChangePasswordDirectly = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + adminCred,
    body: {data: {password: 'newpass'}}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.22)
    test.done()
  })
}

exports.userCannotChangePasswordTooWeak = function(test) {
  t.post({
    uri: '/user/changepw?' + userCred,
    body: {
      userId: testUser._id,
      oldPassword: testUser.password,
      newPassword: 'password',
      installId: '123456',
    }
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.21)
    test.done()
  })
}

exports.userCanChangePassword = function(test) {
  t.post({
    uri: '/user/changepw?' + userCred,
    body: {
      userId: testUser._id,
      oldPassword: testUser.password,
      newPassword: 'newpassword',
      installId: '123456',
    },
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    t.post({
      uri: '/auth/signin',
      body: {email: testUser.email, password: 'newpassword', installId: '123456'},
    }, function(err, res, body) {
      t.assert(body.user)
      t.assert(body.session)
      userOldCred = userCred
      userCred = 'user=' + body.session._owner + '&session=' + body.session.key
      t.assert(userCred !== userOldCred)
      test.done()
    })
  })
}

exports.changingPasswordDestroysOldSession = function(test) {
  t.get({
    uri: '/data/patches?' + userOldCred
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.changingPasswordsCreatesNewSession = function(test) {
  t.get({
    uri: '/data/patches?' + userCred
  }, function(err, res, body) {
    test.done()
  })
}

exports.userCannotChangeRoles = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + userCred,
    body: {data: {role: 'admin'}}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401)
    test.done()
  })
}

exports.userCannotBecomeDeveloper = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + userCred,
    body: {data: {developer: true}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCanMakeUserDeveloper = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + adminCred,
    body: {data: {developer: true}}
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.developer)
    test.done()
  })
}

exports.userCanChangeOwnEmailViaRest = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + userCred,
    body: {data: {email: 'authtest3@3meters.com'}}
  }, function(err, res, body) {
    t.assert(body.data.email === 'authtest3@3meters.com')
    test.done()
  })
}

exports.userCanSignInWithNewEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'authtest3@3meters.com', password: 'newpassword', installId: '123456'}
  }, function(err, res, body) {
    t.assert(body.session)
    userCred = 'user=' + body.session._owner + '&session=' + body.session.key
    test.done()
  })
}


exports.userCannotAddUserViaRest = function(test) {
  t.post({
    uri: '/data/users?' + userCred,
    body: {data: {email: 'authNoRest@3meters.com', password: 'foobar'}}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithoutSecret = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg'},
      },
      installId: '123456',
    },
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithWrongSecret = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg'},
      },
      secret: 'wrongsecret',
      installId: '123456',
    }
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.3)
    test.done()
  })
}


exports.annonymousUserCanCreateUserViaApi = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg'},
      },
      secret: 'larissa',
      installId: '123456',
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    t.assert(body.session.key)
    t.assert(body.user.validateEmailUrl)
    newUserId = body.user._id
    newUserEmailValidateUrl = body.user.validateEmailUrl
    newUserCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}

exports.newUserCanSignIn = function(test) {
  t.get('/data/users?' + newUserCred,
  function(err, res, body) {
    test.done()
  })
}

_exports.newUserEmailValidateUrlWorksSlowly = function(test) {
  t.get('/data/users/' + newUserId, function(err, res, body) {
    t.assert(body.data.validationNotifyDate)
    t.assert(!body.data.validationDate)
    t.get({
      uri: newUserEmailValidateUrl.slice(testUtil.serverUri.length),
      json: false  // call is redirected to an html page
    }, function(err, res, body) {
      t.get('/data/users/' + newUserId, function(err, res, body) {
        t.assert(body.data)
        t.assert(body.data.validationDate)
        t.assert(body.data.validationDate > body.data.validationNotifyDate)
        test.done()
      })
    })
  })
}


exports.newUserEmailValidateUrlWorksFaster = function(test) {
  if (testUtil.disconnected) return testUtil.skip(test)
  t.get('/data/users/' + newUserId + '?' + newUserCred, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.validationNotifyDate)
    t.assert(!body.data.validationDate)

    // Fire without waiting for the callback
    t.get(newUserEmailValidateUrl.slice(testUtil.serverUri.length + 3)) //  for /v1 path prefix

    // Give time for the update to finish, but don't wait for the
    // call to redirect the user to http://patchr.com
    setTimeout(function() {
      t.get('/data/users/' + newUserId + '?' + newUserCred, function(err, res, body) {
        t.assert(body.data.validationDate)
        t.assert(body.data.validationDate > body.data.validationNotifyDate)
        test.done()
      })
    }, 300)
  })
}

exports.changingEmailResetsValidationAndNotifyDates = function(test) {
  var start = util.now()
  t.post({
    uri: '/data/users/' + newUserId + '?' + adminCred,
    body: {data: {email: 'authtest4@3meters.com'}}
  }, function(err, res, body) {
    var user = body.data
    t.assert(user.validationNotifyDate >= start)
    t.assert(!body.data.validationDate)
    test.done()
  })
}


exports.reqValidateFailsForUsers = function(test) {
  t.post({
    uri: '/user/reqvalidate?' + userCred,
    body: {user: {_id: newUserId}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.reqValidateWorksForAdmins = function(test) {
  t.post({
    uri: '/user/reqvalidate?' + adminCred,
    body: {user: {_id: newUserId}}
  }, function(err, res, body) {
    t.assert(body.info)
    test.done()
  })
}

exports.userCanInviteNewUser = function(test) {
  t.post({
    uri: '/user/invite?' + userCred,
    body: {
      emails: ['test@3meters.com'],
      name: 'Test Invite User From t1_auth',
      message: 'This is soooo cool',
      appName: 'aruba',
    }
  }, function(err, res, body) {
    t.assert(body.errors && !body.errors.length)
    t.assert(body.results && body.results.length)
    test.done()
  })
}

exports.autoWatchWorks = function(test) {
  t.post({
    uri: '/data/patches?' + adminCred,
    body: {
      data: {
        _id: util.statics.autowatch[0],
        name: 'test autowatch patch',
      }
    }
  }, 201, function(err, res, body) {
    var seed = String(Math.floor(Math.random() * 1000000))
    t.assert(body.count === 1)
    t.post({
      uri: '/user/create',
      body: {
        data: {
          name: 'TestAutoWatchUser',
          email: 'test' + seed + '@3meters.com',
          password: 'foobar'
        },
        secret: 'larissa',
        installId: '123456',
      }
    }, function(err, res, body) {
      var awUser = body.user
      t.assert(awUser && awUser._id)
      t.assert(body.session && body.session.key)
      var awCred = 'user=' + awUser._id + '&session=' + body.session.key
      t.post({
        uri: '/find/links?' + awCred,
        body: {
          query: {
            _from: awUser._id,
            _to: util.statics.autowatch[0],
            type: 'watch',
          }
        }
      }, function(err, res, body) {
        var watchLinks = body.data
        t.assert(watchLinks && watchLinks.length === 1)
        link = watchLinks[0]
        // OLD: t.assert(link._owner === awUser._id)
        t.assert(link._owner === util.adminId) // changed 8/21/04
        t.del({
          uri: '/data/links/' + link._id + '?' + awCred,
        }, function(err, res, body) {
          t.assert(body.count === 1)  // proves user can unwatch
          // cleanup
          t.del({
            uri: '/data/patches/' + util.statics.autowatch[0] + '?' + adminCred
          }, function(err, res, body) {
            t.assert(body.count === 1)
            test.done()
          })
        })
      })
    })
  })
}


exports.userCanSignOut = function(test) {
  t.get('/auth/signout?' + userCred,
  function(err, res, body) {
    t.get('/data/users?' + userCred, 401,
    function(err, res, body) {
      test.done()
    })
  })
}

