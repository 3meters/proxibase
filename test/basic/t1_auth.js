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
    email: 'authUser@bar.com',
    password: 'foobar'
  }
  adminCred = '',
  userCred = '',
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


exports.cannotAddUserWithoutEmail = function(test) {
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


exports.cannotAddUserWithoutPassword = function(test) {
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


exports.cannotAddUserWithDupeEmail = function(test) {
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


exports.cannotSignInWithWrongFields = function(test) {
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


exports.cannotSignInWithBadEmail = function(test) {
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


exports.cannotSignInWithBadPassword = function(test) {
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


exports.canSignInAsUser = function(test) {
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


exports.canSignInWithDifferentCasedEmail = function(test) {
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


exports.cannotValidateSessionWithBadUser = function(test) {
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


exports.cannotValidateSessionWithBadKey = function(test) {
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
    uri: '/data/users?user=' + session._owner + '&session=' + session.key
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    test.done()
  })
}


exports.canValidateSessionUsingParamsInBody = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table: 'users', user: session._owner, session: session.key}
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


exports.userCannotAddUserViaRest = function(test) {
  var req = new Req({
    uri: '/data/users?' + userCred,
    body: {data: {email: 'authNoRest@bar.com', password: 'foobar'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401)
    test.done()
  })
}


exports.annonymousUserCanCreateUserViaApi = function(test) {
  var req = new Req({
    uri: '/user/create',
    body: {data: {name: 'My Daddy May Be A Robot', 
      email: 'imaNewUser2@bar.com', 
      password: 'foobar'}
    }
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    test.done()
  })
}

exports.userCanSignOutViaGet = function(test) {
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

exports.resetPasswordEmailSends = function(test) {
  // This may be unix-only
  log('nyi')
  test.done()
}

