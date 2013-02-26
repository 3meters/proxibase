/**
 *  Proxibase basic authencation test
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
var testUser = {
  name: 'AuthTestUser',
  email: 'authtest@3meters.com',
  password: 'foobar'
}
var newUserId
var newUserEmailValidateUrl


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
    body: {user: {email: 'admin', password:'admin'}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    adminSession = body.session
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.adminCannotAddUserWithoutEmail = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: {name: 'bob', password: 'foobar'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.adminCannotAddUserWithoutPassword = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: {email: 'foo@bar.com'}}
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
    t.assert(body.data._id)
    testUser._id = body.data._id
    test.done()
  })
}

exports.adminCannotChangeValidateDateViaRest = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + adminCred,
    body: {data: {validationDate: util.getTimeUTC()}}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.22)
    test.done()
  })
}


exports.adminCannotAddUserWithDupeEmail = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.1)
    test.done()
  })
}


exports.userCannotSignInWithWrongFields = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {name: 'Not a user', password: 'password'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.userCannotSignInWithBadEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: 'billy@notHere', password: 'wrong'}}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)
    test.done()
  })
}


exports.userCannotSignInWithBadPassword = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: testUser.email, password: 'wrong'}}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)
    test.done()
  })
}


exports.userCanSignIn = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: testUser.email, password: testUser.password}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    t.assert(body.user.email)
    t.assert(body.user.role && body.user.role === 'user')
    t.assert(body.session)
    session = body.session
    userCred = 'user=' + body.session._owner + '&session=' + body.session.key
    test.done()
  })
}


exports.userCanSignInWithDifferentCasedEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: testUser.email.toUpperCase(), password: testUser.password}}
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
    uri: '/data/documents?user=' + session._owner + '&session=' + session.key
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}


exports.canValidateSessionUsingParamsInBody = function(test) {
  t.post({
    uri: '/do/find',
    body: {table: 'documents', user: session._owner, session: session.key}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}


exports.sessionParamsInQueryStringOverrideOnesInBody = function(test) {
  t.post({
    uri: '/do/find?user=' + session._owner + '&session=' + session.key,
    body: {table: 'users', user: util.adminUser._id, session: session.key}
  }, function(err, res, body) {
    t.post({
      uri: '/do/find?user=' + util.adminUser._id + '&session=' + session.key,
      body: {table: 'users', user: session._owner, session: session.key}
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
    body: {user: {_id: testUser._id, oldPassword: testUser.password, newPassword: 'password'}}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.21)
    test.done()
  })
}


exports.userCanChangePassword = function(test) {
  t.post({
    uri: '/user/changepw?' + userCred,
    body: {user: {_id: testUser._id, oldPassword: testUser.password, newPassword: 'newpassword'}}
  }, function(err, res, body) {
    t.post({
      uri: '/auth/signin',
      body: {user: {email: testUser.email, password: 'newpassword'}}
    }, function(err, res, body) {
      t.assert(body.user)
      t.assert(body.session)
      userOldCred = userCred
      userCred = 'user=' + body.session._owner + '&session=' + body.session.key
      t.assert(userCred != userOldCred)
      test.done()
    })
  })
}


exports.changingPasswordDestroysOldSession = function(test) {
  t.get({
    uri: '/data/documents?' + userOldCred
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.changingPasswordsCreatesNewSession = function(test) {
  t.get({
    uri: '/data/documents?' + userCred
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


exports.adminCanChangeRoles = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + adminCred,
    body: {data: {role: 'lobster'}}
  }, function(err, res, body) {
    test.done()
  })
}


exports.changingEmailResetsValidationNotifyDate = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + userCred,
    body: {data: {email: 'authtest3@3meters.com'}}
  }, function(err, res, body) {
    // TODO: check that validation mail was resent to new email address
    t.assert(!body.data.validationNotifyDate)
    test.done()
  })
}

exports.changingEmailInvalidatesOldSession = function(test) {
  t.get({
    uri: '/data/documents?' + userCred,
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)
    test.done()
  })
}

exports.userCanSignInWithNewEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: 'authtest3@3meters.com', password: 'newpassword'}}
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
    body: {data: {name: 'AuthTestUser2',
      email: 'authtest2@3meters.com',
      password: 'foobar'}
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithWrongSecret = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar'
      },
      secret: 'wrongsecret'
    }
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.3)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithoutWhitelistedEmail = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUserShouldFail',
        email: 'authBest@3meters.com',
        password: 'foobar'
      },
      secret: 'larissa'
    }
  }, 401, function(err, res, body) {
    t.assert(body.error.message.indexOf('support@') >0)
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
        password: 'foobar'
      },
      secret: 'larissa'
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(!body.user.validationDate)
    t.assert(body.user.validateEmailUrl)
    newUserId = body.user._id
    newUserEmailValidateUrl = body.user.validateEmailUrl
    t.assert(body.session)
    test.done()
  })
}


_exports.newUserEmailValidateUrlWorksSlowly = function(test) {
  t.get('/data/users/' + newUserId, function(err, res, body) {
    t.assert(body.data.length)
    t.assert(body.data[0].validationNotifyDate)
    t.assert(!body.data[0].validationDate)
    t.get({
      uri: newUserEmailValidateUrl.slice(testUtil.serverUrl.length),
      json: false  // call is redirected to an html page
    }, function(err, res, body) {
      t.get('/data/users/' + newUserId, function(err, res, body) {
        t.assert(body.data.length)
        t.assert(body.data[0].validationDate)
        t.assert(body.data[0].validationDate > body.data[0].validationNotifyDate)
        test.done()
      })
    })
  })
}

exports.newUserEmailValidateUrlWorksFaster = function(test) {
  t.get('/data/users/' + newUserId, function(err, res, body) {
    t.assert(body.data.length)
    t.assert(body.data[0].validationNotifyDate)
    t.assert(!body.data[0].validationDate)

    // Fire without waiting for the callback
    t.get(newUserEmailValidateUrl.slice(testUtil.serverUrl.length))

    // Give time for the update to finish, but don't wait for the
    // call to redirect the user to http://aircandi.com
    setTimeout(function() {
      t.get('/data/users/' + newUserId, function(err, res, body) {
        t.assert(body.data.length)
        t.assert(body.data[0].validationDate)
        t.assert(body.data[0].validationDate > body.data[0].validationNotifyDate)
        test.done()
      })
    }, 100)
  })
}


exports.userCanSignOut = function(test) {
  t.get({
    uri: '/auth/signout?' + userCred,
  }, function(err, res, body) {
    t.get({
      uri: '/data/users?' + userCred,
    }, 401, function(err, res, body) {
      test.done()
    })
  })
}

