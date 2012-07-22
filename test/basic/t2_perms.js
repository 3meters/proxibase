
/*
 *  Proxibase permission test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  str = JSON.stringify,
  adminCred = '',
  user1Cred = '',
  user2Cred = '',
  user1 = {
    name: 'Perm Test User 1',
    email: 'permTestUser1@bar.com',
    password: 'foobarfoobar'
  },
  user2 = {
    name: 'Perm Test User 2',
    email: 'permTestUser2@bar.com',
    password: 'foobarfoobar'
  },
  _exports = {},                    // for commenting out tests
  log = require('../../lib/util').log


exports.signinAsAdmin = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = str({ user: { email: 'admin', password: 'admin' }})
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
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = str({data:user1})
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data && res.body.data._id)
    user1._id = res.body.data._id
    test.done()
  })
}


exports.addUser2 = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = str({data:user2})
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data && res.body.data._id)
    user2._id = res.body.data._id
    test.done()
  })
}


exports.signinUser1 = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = str({ user: { email: user1.email, password: user1.password }})
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
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = str({ user: { email: user2.email, password: user2.password }})
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
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + user1._id + '?' + user1Cred
  req.body = str({data: {location: 'Orlando'}})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    assert(res.body.user.location === 'Orlando')
    test.done()
  })
}


exports.userCannotUpdateOtherPeoplesRecords = function(test) {
  next()
}

exports.userCanCreateARecord = function(test) {
  next()
}

exports.userCannotDeleteOthersRecords = function(test) {
  next()
}

exports.userCanDeleteOwnRecords = function(test) {
  next()
}

exports.adminsCanUpdateOthersRecords = function(test) {
  next()
}

exports.adminsCanDeleteOthersRecords function(test) {
  next()
}


