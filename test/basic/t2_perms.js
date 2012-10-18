
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
    email: 'permtest1@3meters.com',
    password: 'foobar'
  },
  user2 = {
    name: 'Perm Test User 2',
    email: 'permtest2@3meters.com',
    password: 'foobar'
  },
  doc1 = {
    name: 'Doc1',
    data: { foo: 'bar' }
  },
  _exports = {},                    // for commenting out tests
  util = require('util'),
  log = util.log


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
    uri: '/user/create?' + adminCred,
    body: {data: user1, noValidate: true, secret: 'larissa'},
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.session)
    assert(res.body.user && res.body.user._id)
    user1._id = res.body.user._id
    test.done()
  })
}


exports.addUser2 = function(test) {
  var req = new Req({
    uri: '/user/create?' + adminCred,
    body: {data: user2, noValidate: true, secret: 'larissa'}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.session)
    assert(res.body.user && res.body.user._id)
    user2._id = res.body.user._id
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
    uri: '/data/users/' + user1._id + '?' + user1Cred,
    body: {data: {location: 'Orlando'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.data.location === 'Orlando')
    test.done()
  })
}


exports.user1CannotUpdateUser2sRecord = function (test) {
  var req = new Req({
    uri: '/data/users/' + user2._id + '?' + user1Cred,
    body: {data: {location: 'Denver'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.cannotAddRecordsWhenNotSignedIn = function(test) {
  var req = new Req({
    uri: '/data/documents',
    body: {data: doc1}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.user1CanCreateARecord = function(test) {
  var req = new Req({
    uri: '/data/documents' + '?' + user1Cred,
    body: {data: doc1}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data._id)
    doc1._id = res.body.data._id
    test.done()
  })
}


exports.user1OwnsRecordsHeCreates = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents/' + doc1._id + '?' + user1Cred,
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data._owner = user1._id)
    test.done()
  })
}


exports.user2CannotUpdateUser1sRecords = function(test) {
  var req = new Req({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {name: 'I updated your doc sucka'}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.user2CannotDeleteUser1sRecords = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.user1CanUpdateRecordsHeCreated = function(test) {
  var req = new Req({
    uri: '/data/documents/' + doc1._id + '?' + user1Cred,
    body: {data: {name: 'I updated my own document'}}
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}


exports.user1CanDeleteHisOwnRecords = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/' + doc1._id + '?' + user1Cred,
  })
  request(req, function(err, res) {
    check(req, res, 200)
    assert(res.body.count && res.body.count === 1)
    test.done()
  })
}


exports.user2CanCreateARecord = function(test) {
  delete doc1._id
  var req = new Req({
    uri: '/data/documents' + '?' + user2Cred,
    body: {data: doc1}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data._id)
    doc1._id = res.body.data._id
    test.done()
  })
}


exports.user2CannotChangeOwnerOfHerOwnRecord = function(test) {
  var req = new Req({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {_owner: util.adminUser._id}}
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.adminCanUpdateOthersRecords = function(test) {
  var req = new Req({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {name: 'I can update any document I please'}}
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}


exports.adminCanChangeOwnerOfOthersRecords = function(test) {
  var req = new Req({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {_owner: util.adminUser._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.adminCanDeleteOthersRecords = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
  })
  request(req, function(err, res) {
    check(req, res, 200)
    assert(res.body.count && res.body.count === 1)
    test.done()
  })
}



