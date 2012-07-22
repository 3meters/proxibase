
/*
 *  Proxibase permission test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  adminCred = '',
  user1Cred = '',
  user2Cred = '',
  user1 = {
    name: 'Perm Test User 1',
    email: 'permTestUser1@bar.com',
    password: 'foobar'
  },
  user2 = {
    name: 'Perm Test User 2',
    email: 'permTestUser2@bar.com',
    password: 'foobar'
  },
  _exports = {},                    // for commenting out tests
  log = require('../../lib/util').log


exports.signInAsAdmin = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: 'admin', password: 'admin'}}
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


exports.addUser1 = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data:user1}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data && res.body.data._id)
    user1._id = res.body.data._id
    test.done()
  })
}


exports.addUser2 = function(test) {
  var req = new Req({
    uri: '/data/users?' + adminCred,
    body: {data:user2}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data && res.body.data._id)
    user2._id = res.body.data._id
    test.done()
  })
}


exports.signinUser1 = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: user1.email, password: user1.password}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    // These credentials will be useds in subsequent tests
    user1Cred = 'user=' + res.body.user._id + '&session=' + res.body.session.key
    test.done()
  })
}


exports.signinUser2 = function(test) {
  var req = new Req({
    uri: '/auth/signin',
    body: {user: {email: user2.email, password: user2.password}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    // These credentials will be useds in subsequent tests
    user2Cred = 'user=' + res.body.user._id + '&session=' + res.body.session.key
    test.done()
  })
}


exports.user1CanUpdateOwnRecord = function (test) {
  var req = new Req({
    uri: '/data/users/ids:' + user1._id + '?' + user1Cred,
    body: {data: {location: 'Orlando'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    assert(res.body.data.location === 'Orlando')
    test.done()
  })
}


exports.user1CannotUpdateUser2UserRecord= function(test) {
  console.error('nyi')
  test.done()
}


exports.user1CannotUpdateUser2Record= function(test) {
  console.error('nyi')
  test.done()
}



exports.userCanCreateARecord = function(test) {
  console.error('nyi')
  test.done()
}

exports.userCannotDeleteOthersRecords = function(test) {
  console.error('nyi')
  test.done()
}

exports.userCanDeleteOwnRecords = function(test) {
  console.error('nyi')
  test.done()
}

exports.adminsCanUpdateOthersRecords = function(test) {
  console.error('nyi')
  test.done()
}

exports.adminsCanDeleteOthersRecords = function(test) {
  console.error('nyi')
  test.done()
}


