/**
 *  Proxibase permission test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var adminCred
var user1Cred
var user2Cred
var user1 = {
  name: 'Perm Test User 1',
  email: 'permtest1@3meters.com',
  password: 'foobar'
}
var user2 = {
  name: 'Perm Test User 2',
  email: 'permtest2@3meters.com',
  password: 'foobar'
}
var doc1 = {
  name: 'Doc1',
  data: { foo: 'bar' }
}
var _exports = {}                    // for commenting out tests


exports.signInAsAdmin = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: 'admin', password: 'admin'}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.addUser1 = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {data: user1, noValidate: true, secret: 'larissa'},
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user && body.user._id)
    user1._id = body.user._id
    test.done()
  })
}


exports.addUser2 = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {data: user2, noValidate: true, secret: 'larissa'}
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user && body.user._id)
    user2._id = body.user._id
    test.done()
  })
}


exports.signinUser1 = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: user1.email, password: user1.password}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    user1Cred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.signinUser2 = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: user2.email, password: user2.password}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    user2Cred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.user1CanUpdateOwnRecord = function (test) {
  t.post({
    uri: '/data/users/' + user1._id + '?' + user1Cred,
    body: {data: {location: 'Orlando'}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.data.location === 'Orlando')
    test.done()
  })
}


exports.user1CannotUpdateUser2sRecord = function(test) {
  t.post({
    uri: '/data/users/' + user2._id + '?' + user1Cred,
    body: {data: {location: 'Denver'}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.cannotAddRecordsWhenNotSignedIn = function(test) {
  t.post({
    uri: '/data/documents',
    body: {data: doc1}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.user1CanCreateARecord = function(test) {
  t.post({
    uri: '/data/documents' + '?' + user1Cred,
    body: {data: doc1}
  }, 201, function(err, res, body) {
    t.assert(body.data._id)
    doc1._id = body.data._id
    test.done()
  })
}


exports.user1OwnsRecordsHeCreates = function(test) {
  t.get('/data/documents/' + doc1._id + '?' + user1Cred,
  function(err, res, body) {
    t.assert(body.data._owner = user1._id)
    test.done()
  })
}


exports.user2CannotUpdateUser1sRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {name: 'I updated your doc sucka'}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.user2CannotDeleteUser1sRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + user2Cred}, 401,
  function(err, res) {
    test.done()
  })
}


exports.user1CanUpdateRecordsHeCreated = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user1Cred,
    body: {data: {name: 'I updated my own document'}}
  }, function(err, res, body) {
    test.done()
  })
}


exports.user1CanDeleteHisOwnRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + user1Cred},
  function(err, res, body) {
    t.assert(body.count && body.count === 1)
    test.done()
  })
}


exports.user2CanCreateARecord = function(test) {
  delete doc1._id
  t.post({
    uri: '/data/documents' + '?' + user2Cred,
    body: {data: doc1}
  }, 201, function(err, res, body) {
    t.assert(body.data._id)
    doc1._id = body.data._id
    test.done()
  })
}


exports.user2CannotChangeOwnerOfHerOwnRecord = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {_owner: util.adminUser._id}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.adminCanUpdateOthersRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {name: 'I can update any document I please'}}
  }, function(err, res, body) {
    test.done()
  })
}

exports.adminCanChangeOwnerOfOthersRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {_owner: util.adminUser._id}}
  }, function(err, res, body) {
    test.done()
  })
}

exports.adminCanDeleteOthersRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + adminCred}, 
  function(err, res, body) {
    t.assert(body.count && body.count === 1)
    test.done()
  })
}
