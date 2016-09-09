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
var _user
var userOldCred
var session = {}
var adminSession = {}
var _exports = {}                    // for commenting out tests
var qs = require('querystring')
var seed = String(Math.floor(Math.random() * 1000000))
var testUser = {
  name: 'AuthTestUser',
  type: 'user',
  email: 'authtest' + seed + '@3meters.com',
  password: 'foobar',
  photo: {prefix: 'authTestUser.jpg', source:"aircandi.images"},
}
var newUser
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
    body: {email: 'admin', password: 'admin'}
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
    body: {email: 'anonymous', password: 'anonymous'}
  }, 401, function(err, res, body) {
    t.assert(401.1 === body.error.code)
    test.done()
  })
}

exports.adminCannotAddUserWithoutEmail = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {user: {name: 'bob', password: 'foobar'},
        secret: 'larissa'}
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
    body: {data: testUser, secret: 'larissa'}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.1)
    test.done()
  })
}

exports.userCannotSignInWithWrongFields = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {name: 'Not a user', password: 'password'}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.userCannotSignInWithBadEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'billy@notHere', password: 'wrong'}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.4) // email address not found
    test.done()
  })
}

exports.userCannotSignInWithBadPassword = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email, password: 'wrong'}
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.1)  // bad credentials
    test.done()
  })
}

exports.userCanSignIn = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email, password: testUser.password}
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
    _user = body.session._owner
    test.done()
  })
}

exports.userCanSignInWithDifferentCasedEmail = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: testUser.email.toUpperCase(), password: testUser.password}
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
    },
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    t.post({
      uri: '/auth/signin',
      body: {email: testUser.email, password: 'newpassword'}
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

exports.adminCanChangePassword = function(test) {
  t.post({
    uri: '/user/changepw?' + adminCred,
    body: {
      userId: testUser._id,
      newPassword: 'newpassword2',
    },
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
    body: {email: 'authtest3@3meters.com', password: 'newpassword2'}
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


exports.annonUserCannotCreateUserViaApiWithoutSecret = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg', source:"aircandi.images"},
      },
    },
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.annonUserCannotCreateUserViaApiWithWrongSecret = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg', source:"aircandi.images"},
      },
      secret: 'wrongsecret',
    }
  }, 401, function(err, res, body) {
    t.assert(body.error.code === 401.3)
    test.done()
  })
}


exports.annonUserCanCreateUserViaApi = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar',
        photo: {prefix: 'authTestUser.jpg', source:"aircandi.images"},
      },
      secret: 'larissa',
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    t.assert(body.session.key)
    t.assert(body.user.validateEmailUrl)
    newUser = body.user
    newUserId = body.user._id
    newUserEmailValidateUrl = body.user.validateEmailUrl
    newUserCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}

exports.newUserCanSignIn = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {
      email: 'authtest2@3meters.com',
      password: 'foobar',
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === newUser._id)
    test.done()
  })
}


exports.newUserEmailValidateUrlWorks = function(test) {
  if (testUtil.disconnected) return testUtil.skip(test)
  t.get('/data/users/' + newUserId + '?' + newUserCred, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.validationNotifyDate)
    t.assert(!body.data.validationDate)

    // Fire without waiting for the callback
    t.get(newUserEmailValidateUrl.slice(testUtil.serverUri.length + 3)) // slice off the /v1 as well

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
    uri: '/user/email/reqvalidate?' + userCred,
    body: {user: {_id: newUserId}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.reqValidateWorksForAdmins = function(test) {
  t.post({
    uri: '/user/email/reqvalidate?' + adminCred,
    body: {user: {_id: newUserId}}
  }, function(err, res, body) {
    t.assert(body.info)
    test.done()
  })
}

exports.autoWatchWorks = function(test) {
  var seed = String(Math.floor(Math.random() * 1000000))
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'TestAutoWatchUser',
        email: 'test' + seed + '@3meters.com',
        password: 'foobar'
      },
      secret: 'larissa',
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
      t.assert(link._owner === util.adminId) // changed 8/21/14
      t.del({
        uri: '/data/links/' + link._id + '?' + awCred,
      }, function(err, res, body) {
        t.assert(body.count === 1)  // proves user can unwatch
        test.done()
      })
    })
  })
}

exports.userCanSelfLike = function(test) {
  t.post({
    uri: '/data/links?' + newUserCred,
    body: {data: {
      _to: newUser._id,
      _from: newUser._id,
      type: 'like',
    }}
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._to === newUser._id)
    t.assert(body.data._from === newUser._id)
    t.assert(body.data.type === 'like')
    test.done()
  })
}

exports.userCanSignOut = function(test) {
  t.get('/auth/signout?' + userCred,
  function(err, res, body) {
    t.get('/data/users?' + userCred, 401,
    function(err, res, body) {

      // Confirm session deleted
      t.get('/data/sessions?q[_owner]=' + _user + '&' + adminCred,
      function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}

// Supported
exports.userCanSignInWithLinked = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {
      email: 'authtest4@3meters.com',
      password: 'foobar',
      linked: [{to: 'users', type: 'like', linkFields: '_to,_from,type'}],
    }
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.credentials)
    t.assert(body.user)
    t.assert(body.user._id === newUser._id)
    t.assert(body.user.linked)
    t.assert(body.user.linked.length === 1)
    var linked = body.user.linked[0]
    t.assert(linked._id === body.user._id)
    t.assert(linked.link)
    t.assert(linked.link._to === body.user._id)
    t.assert(linked.link._from === body.user._id)
    t.assert(linked.link.type === 'like')
    test.done()
  })
}


// Circular JSON fails properly
exports.circularJsonFailsProperly = function(test) {
  var obj = {
    name: 'foo',
  }
  obj.data = obj  // create circular reference
  t.post({
    uri: '/data/documents?' + adminCred,
    body: {data: obj}
  }, 400, function(err, res, body) {
    test.done()
  })
}
