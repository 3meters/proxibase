/*
 *  Proxibase basic authencation test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  Req = testUtil.Req,
  str = JSON.stringify,
  testUser = {
    name: 'AuthTestUser',
    email: 'authUser@bar.com',
    password: 'foobar'
  }
  adminCred = '',
  userCred = '',
  session = {},
  _exports = {},                    // for commenting out tests
  log = require('../../lib/util').log


exports.CantAddUserWhenNotSignedIn = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/data/users',
    body: {data: {email: 'foo@bar.com', password: 'foobarfoo'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.CanSignInAsAdmin = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/auth/signin',
    body: {user: {email: 'admin', password:'admin'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + res.body.user._id + '&session=' + res.body.session.key
    test.done()
  })
}


exports.cantAddUserWithoutEmail = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/data/users?' + adminCred,
    body: {data: {name: 'bob', password: 'foobar'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1, dump(req, res))
    test.done()
  })
}


exports.cantAddUserWithoutPassword = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/data/users?' + adminCred,
    body: {data: {email: 'foo@bar.com'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1)
    test.done()
  })
}


exports.canAddUser = function(test) {
  var req = new Req({
    method: 'post',
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


exports.cantAddUserWithDupeEmail = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  })
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.1)
    test.done()
  })
}


exports.cantSignInWithWrongFields = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/auth/signin',
    body: {user: {name: 'Not a user', password: 'password'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1, dump(req,res))
    test.done()
  })
}


exports.cantSignInWithBadEmail = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/auth/signin',
    body: {user: {email: 'billy@notHere', password: 'wrong'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.cantSignInWithBadPassword = function(test) {
  var req = new Req({
    method: 'post',
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
    method: 'post',
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
    method: 'post',
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


exports.cantValidateSessionWithBadUser = function(test) {
  var req = new Req({
    uri: '/data/users?user=bogus&session=' + session.key
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.cantValidateSessionWithBadKey = function(test) {
  var req = new Req({
    uri: '/data/users?user=' + session._owner + '&session=bogus'
  })
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.CanValidateSession = function(test) {
  var req = new Req({
    uri: '/data/users?user=' + session._owner + '&session=' + session.key
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    assert(res.body.session)
    assert(res.body.session.key === session.key)
    test.done()
  })
}


exports.canValidateSessionUsingParamsInBody = function(test) {
  var req = new Req({
    method: 'post',
    uri: '/do/find',
    body: {table: 'users', user: session._owner, session: session.key}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === testUser._id)
    assert(res.body.user.name === testUser.name)
    assert(res.body.session)
    assert(res.body.session.key === session.key)
    test.done()
  })
}


exports.sessionParamsInQueryStringOverrideOnesInBody = function(test) {
  // Implement
  test.done()
}


exports.adminCannotChangePasswordDirectly = function(test) {
  var req = new Req({
    method: 'post',
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
    method: 'post',
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
    method: 'post',
    uri: '/user/changepw?' + userCred,
    body: {user: {_id: testUser._id, oldPassword: testUser.password, newPassword: 'newpassword'}}
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

