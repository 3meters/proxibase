/*
 *  Proxibase rest basic test
 */

var
  assert = require('assert'),
  request = require('request'),
  util = require('../../lib/util'),
  log = util.log,
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  userCred = '',
  testDoc1 = {
    name: "Test Rest Doc 1",
    data: { foo: 'bar', number: 1 }
  },
  testDoc1Saved = {},
  testDoc2 = {
    name: "Test Rest Doc 2",
    data: { foo: 'bar', number: 2 }
  },
  userSession,
  testStartTime = util.getTimeUTC(),
  _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
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


exports.findDocsByIdAndCheckSysFields = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents/ids:' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 2, dump(req, res))
    assert(res.body.data[0]._id === testDoc1._id, dump(req, res))
    assert(res.body.data[1].name === testDoc2.name, dump(req, res))
    assert(res.body.data[0]._creator === userSession._owner)
    assert(res.body.data[0]._owner === userSession._owner)
    assert(res.body.data[0].createdDate > testStartTime)
    assert(res.body.data[0].modifiedDate > testStartTime)
    testDoc1Saved = res.body.data[0]
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
    assert(res.body.data[0].modifiedDate > testDoc1Saved.modifiedDate)
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

exports.cannotUpdateNonExistantDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/ids:0000?' + userCred,
    body: {data: {name: 'I should fail'}}
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}


exports.canAddDocsWithPreexitingIds = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: '1234', name: 'I have my own id'}}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data._id)
    assert(res.body.data._id === '1234')
    var req2 = new Req({
      uri: '/data/documents?' + userCred,
      body: {data: {_id: '5678', name: 'I do too'}}
    })
    request(req2, function(err, res) {
      check(req2, res, 201)
      test.done()
    })
  })
}

exports.cannotLinkDocToBogusTableId = function(test) {
  log('nyi')
  test.done()
}


exports.canLinkDocs = function(test) {
  log('nyi')
  test.done()
}


exports.canDeleteDocLinks = function(test) {
  log('nyi')
  test.done()
}



exports.userCannotDeleteWildcard = function(test) {
  log('nyi')
  test.done()
}


exports.userCanDeleteMultipleDocs = function(test) {
  log('nyi')
  test.done()
}


exports.adminCanDeleteWildcard = function(test) {
  log('nyi')
  test.done()
}

exports.userCanCreateLinksToHisOwnRecords = function(test) {
  log('nyi')
  test.done()
}

exports.userCannotCreateLinksToLockedRecords = function(test) {
  log('nyi')
  test.done()
}

exports.userCannotCreateLinksToRecordsThatDoNotExist = function(test) {
  log('nyi')
  test.done()
}
