/*
 *  Proxibase basic authencation test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  testUser = {
    name: 'AuthTestUser',
    email: 'authtest@3meters.com',
    password: 'foobar'
  }
  adminCred = '',
  userCred = '',
  userOldCred = '',
  session = {},
  adminSession = {},
  _exports = {},                    // for commenting out tests
  util = require('../../lib/util'),
  log = util.log


exports.cannotAddUserWhenNotSignedIn = function(test) {
  var req = new Req({
    uri: '/data/users',
    body: {data: {email: 'foo@bar.com', password: 'foobarfoo'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.canSignInAsAdmin = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: 'admin', password:'admin'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    adminSession = res.body.session
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + res.body.user._id + '&session=' + res.body.session.key
    test.done()
  })
}


exports.adminCannotAddUserWithoutEmail = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data: {name: 'bob', password: 'foobar'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1, dump(req, res))
    test.done()
  })
}


exports.adminCannotAddUserWithoutPassword = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data: {email: 'foo@bar.com'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1)
    test.done()
  })
}


exports.adminCanAddUserViaRest = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data._id)
    testUser._id = res.body.data._id
    test.done()
  })
}

exports.userCanValidateEmail = function(test) {
  // TODO: implement.  This will require the node imap module to log into
  // the test user mail account, receive and parse the notification mail,
  // send the get request embeded in the mail, and confirm that the 
  // validation flag is properle set on the user record
  log('nyi')
  test.done()
}


exports.adminCannotChangeValidateDateViaRest = function(test) {
  var req = new Req({
    uri: '/data/users/ids:' + testUser._id + '?' + adminCred,
    body: {data: {validationDate: util.getTimeUTC()}}
  })
  request(req, function(err, res) {
    check(req, res, 403)  // forbidden
    assert(res.body.error.code === 403.22)
    test.done()
  })
}


exports.adminCannotAddUserWithDupeEmail = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  })
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.1)
    test.done()
  })
}


exports.userCannotSignInWithWrongFields = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {name: 'Not a user', password: 'password'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1, dump(req,res))
    test.done()
  })
}


exports.userCannotSignInWithBadEmail = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: 'billy@notHere', password: 'wrong'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.userCannotSignInWithBadPassword = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: testUser.email, password: 'wrong'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.userCanSignIn = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: testUser.email, password: testUser.password}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    assert(res.body.user.email)
    assert(res.body.user.role && res.body.user.role === 'user')
    assert(res.body.session)
    session = res.body.session
    userCred = 'user=' + res.body.session._owner + '&session=' + res.body.session.key
    test.done()
  })
}


exports.userCanSignInWithDifferentCasedEmail = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: testUser.email.toUpperCase(), password: testUser.password}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    assert(res.body.user.email)
    assert(res.body.session)
    test.done()
  })
}


exports.cannotValidateSessionWithBogusUser = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/users?user=bogus&session=' + session.key
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.cannotValidateSessionWithBogusKey = function(test) {
  var req = new Req({
    method: 'get', 
    uri: '/data/users?user=' + session._owner + '&session=bogus'
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.canValidateSession = function(test) {
  var req = new Req({
    method: 'get', 
    uri: '/data/documents?user=' + session._owner + '&session=' + session.key
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user, dump(req, res))
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    test.done()
  })
}


exports.canValidateSessionUsingParamsInBody = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table: 'documents', user: session._owner, session: session.key}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    test.done()
  })
}


exports.sessionParamsInQueryStringOverrideOnesInBody = function(test) {
  var req = new Req({
    uri: '/do/find?user=' + session._owner + '&session=' + session.key,
    body: {table: 'users', user: util.adminUser._id, session: session.key}
  })
  request(req, function(err, res) {
    check(req, res)
    var req2 = new Req({
      uri: '/do/find?user=' + util.adminUser._id + '&session=' + session.key,
      body: {table: 'users', user: session._owner, session: session.key}
    })
    request(req2, function(err, res) {
      check(req, res, 401)
      test.done()
    })
  })
}


exports.adminCannotChangePasswordDirectly = function(test) {
  var req = new Req({
    uri: '/data/users/ids:' + testUser._id + '?' + adminCred,
    body: {data: {password: 'newpass'}}
  })
  request(req, function(err, res) {
    check(req, res, 403)  // forbidden
    assert(res.body.error.code === 403.22)
    test.done()
  })
}


exports.userCannotChangePasswordTooWeak = function(test) {
  var req = new Req({
    uri: '/user/changepw?' + userCred,
    body: {user: {_id: testUser._id, oldPassword: testUser.password, newPassword: 'password'}}
  })
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.21)
    test.done()
  })
}


exports.userCanChangePassword = function(test) {
  var req = new Req({
    uri: '/user/changepw?' + userCred,
    body: {user: {_id: testUser._id, oldPassword: testUser.password, newPassword: 'newpassword'}}
  })
  request(req, function(err, res) {
    check(req, res)
    var req2 = new Req({
      uri: '/auth/signin',
      body: {user: {email: testUser.email, password: 'newpassword'}}
    })
    request(req2, function(err, res) {
      check(req2, res)
      assert(res.body.user)
      assert(res.body.session)
      userOldCred = userCred
      userCred = 'user=' + res.body.session._owner + '&session=' + res.body.session.key
      assert(userCred != userOldCred)
      test.done()
    })
  })
}


exports.changingPasswordDestroysOldSession = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?' + userOldCred
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.changingPasswordsCreatesNewSession = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}


exports.userCannotChangeRoles = function(test) {
  var req = new Req({
    uri: '/data/users/ids:' + testUser._id + '?' + userCred,
    body: {data: {role: 'admin'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401)
    test.done()
  })
}


exports.adminCanChangeRoles = function(test) {
  var req = new Req({
    uri: '/data/users/ids:' + testUser._id + '?' + adminCred,
    body: {data: {role: 'lobster'}}
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}


exports.changingEmailResetsValidationNotifyDate = function(test) {
  var req = new Req({
    uri: '/data/users/ids:' + testUser._id + '?' + userCred,
    body: {data: {email: 'authtest3@3meters.com'}}
  })
  request(req, function(err, res) {
    check(req, res)
    // TODO: check that validation mail was resent to new email address
    assert(!res.body.data.validationNotifyDate)
    test.done()
  })
}

exports.changingEmailInvalidatesOldSession = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?' + userCred,
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}

exports.userCanSignInWithNewEmail = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: 'authtest3@3meters.com', password: 'newpassword'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.session)
    userCred = 'user=' + res.body.session._owner + '&session=' + res.body.session.key
    test.done()
  })
}


exports.userCannotAddUserViaRest = function(test) {
  var req = new Req({
    uri: '/data/users?' + userCred,
    body: {data: {email: 'authNoRest@3meters.com', password: 'foobar'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithoutSecret = function(test) {
  var req = new Req({
    uri: '/user/create',
    body: {data: {name: 'AuthTestUser2',
      email: 'authtest2@3meters.com',
      password: 'foobar'}
    }
  })
  // Signs the user in as well
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1)
    test.done()
  })
}


exports.annonymousUserCannotCreateUserViaApiWithWrongSecret = function(test) {
  var req = new Req({
    uri: '/user/create',
    body: {
      data: {name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar'
      },
      secret: 'wrongsecret'
    }
  })
  // Signs the user in as well
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.3)
    test.done()
  })
}


exports.annonymousUserCanCreateUserViaApi = function(test) {
  var req = new Req({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthTestUser2',
        email: 'authtest2@3meters.com',
        password: 'foobar'
      },
      secret: 'larissa'
    }
  })
  // Signs the user in as well
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(!res.body.user.validationDate)
    assert(res.body.session)
    test.done()
  })
}


exports.userCanSignOut = function(test) {
  var req = new Req({
    uri: '/auth/signout?' + userCred,
    method: 'get'
  })
  request(req, function(err, res) {
    check(req, res)
    var req2 = new Req({
      uri: '/data/users?' + userCred,
      method: 'get'
    })
    request(req2, function(err, res) {
      check(req, res, 401)
      test.done()
    })
  })
}


