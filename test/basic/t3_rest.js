/*
 *  Proxibase rest basic test
 */

var
  assert = require('assert'),
  request = require('request'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  Req = testUtil.Req
  check = testUtil.check,
  dump = testUtil.dump,
  userCred = '',
  testDoc1 = {
    name: "Test Rest Doc 1",
    data: { foo: 'bar', number: 1 }
  },
  testDoc2 = {
    name: "Test Rest Doc 2",
    data: { foo: 'bar', number: 2 }
  },
  _exports = {}  // For commenting out tests


exports.getSession = function(test) {
  testUtil.getSession(function(err, session) {
    if (err) throw err
    userCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


exports.cannotPostDocWithMissingDataTag = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {'name': 'ForgotToEncloseDataInDataTag'}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}


exports.cannotPostWithMultipleArrayElements = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: [
      {
        name: "RestTestMultiDoc0",
      },{
        name: "RestTestMultiDoc1",
      }
    ]}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}


exports.cannotPostWithNonSchemaFields = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: {name: 'I make up fields', myField: 'foo'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.11) // Bad parameter
    test.done()
  })
}


exports.canAddDoc = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc1}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    testDoc1._id = res.body.data._id
    test.done()
  })
}


exports.canAddDocAsSingleElementArray = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc2}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data && res.body.data._id)
    testDoc2._id = res.body.data._id
    test.done()
  })
}


exports.findDocsByIdsWhenSignedIn = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents/ids:' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 2, dump(req, res))
    assert(res.body.data[0]._id === testDoc1._id, dump(req, res))
    assert(res.body.data[1].name === testDoc2.name, dump(req, res))
    test.done()
  })
}


_exports.findDocsByNameWhenNotSignedIn = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents/names:' + testDoc1.name.toUpperCase() + ',' + testDoc2.name
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 2, dump(req, res))
    test.done()
  })
}


exports.updateDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/ids:' + testDoc1._id + '?' + userCred,
    body: {data: {name: "Changed Name" } }
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data.name)
    assert(res.body.data.name === 'Changed Name', dump(req, res))
    test.done()
  })
}


exports.checkUpdatedDoc = function(test) {
  var req = new Req({
    method: 'gET',
    uri: '/data/documents/ids:' + testDoc1._id
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0])
    assert(res.body.data[0].name === 'Changed Name', dump(req, res))
    test.done()
  })
}


exports.cannotAddNonSchemaFieldsUsingUpdate = function(test) {
  var req = new Req({
    uri: '/data/documents/ids:' + testDoc1._id + '?' + userCred,
    body: {data: {myNewField: "Should fail" } }
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.11) // Bad parameter
    test.done()
  })
}


exports.deleteUpdateDoc = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/ids:' + testDoc1._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}


exports.checkUpdatedDocDeleted = function(test) {
  var req = new Req({
    method: 'gET',
    uri: '/data/documents/ids:' + testDoc1._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}


exports.updateNonExistantDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/ids:0000?' + userCred,
    body: {data: {name: 'I should fail'}}
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}

exports.canAddDocWithPreexitingId = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: '1234567', name: 'I have my own id'}}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data._id)
    assert(res.body.data._id === '1234567')
    test.done()
  })
}
