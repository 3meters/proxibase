/*
 *  Proxibase rest basic test
 */

var
  assert = require('assert'),
  request = require('request'),
  util = require('util'),
  log = util.log,
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  userSession,
  userCred,
  adminSession,
  adminCred,
  documentsSchemaId = 5,  // will break if we change schemaIds
  testDoc1 = {
    name: "Test Rest Doc 1",
    data: { foo: 'bar', number: 1 }
  },
  testDoc1Saved = {},
  testDoc2 = {
    name: "Test Rest Doc 2",
    data: { foo: 'bar', number: 2 }
  },
  linkId,
  testStartTime = util.getTimeUTC(),
  _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
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


// TODO: only enforced by REST.  Custom methods bypass
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

exports.cannotAddDocMissingRequiredField = function(test) {
  var req = new Req({
    uri: '/data/entities?' + userCred,
    body: {data: {name: 'Test Entity Missing its type'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1) // missingParam
    test.done()
  })
}

exports.findDocsByIdAndCheckSysFields = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
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



exports.findDocsByGetAndFindAndJson = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?find={"_id":"' + testDoc1._id + '"}&' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.length === 1, dump(req, res))
    test.done()
  })
}

exports.findDocsByGetAndFindAndJsonFailsWithBadUserCred = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?find={"_id":"' + testDoc1._id + '"}&' + userCred.slice(0, -1) // bogus session key
  })
  request(req, function(err, res) {
    check(req, res, 401) // badAuth
    test.done()
  })
}

exports.findDocsByGetAndFindWithBadJson = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?find={_id:"' + testDoc1._id + '"}&' + userCred
  })
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}

exports.findDocsByNameWhenNotSignedIn = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?names=' + testDoc1.name.toUpperCase() + ',' + testDoc2.name
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 2, dump(req, res))
    test.done()
  })
}

exports.findWithLookups = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/documents?names=' + testDoc1.name + '&lookups=1'
  })
  request(req, function(err, res) {
    check(req, res)
    var doc = res.body.data[0]
    assert('Test User' === doc.owner, dump(req, res))
    assert('Test User' === doc.creator, dump(req, res))
    assert('Test User' === doc.modifier, dump(req, res))
    test.done()
  })
}



exports.updateDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
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
    uri: '/data/documents/' + testDoc1._id
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0])
    assert(res.body.data[0].name === 'Changed Name', dump(req, res))
    // Ensures modified date is getting set on update
    assert(res.body.data[0].modifiedDate > testDoc1Saved.modifiedDate)
    test.done()
  })
}


exports.cannotAddNonSchemaFieldsUsingUpdate = function(test) {
  var req = new Req({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
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
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}


exports.checkUpdatedDocDeletedThenAddBack = function(test) {
  var req = new Req({
    method: 'gET',
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    var req2 = new Req({
      uri: '/data/documents?' + userCred,
      body: {data: testDoc1}
    })
    request(req2, function(err, res) {
      check(req, res, 201)
      assert(res.body.data._id = testDoc1._id)
      test.done()
    })
  })
}

exports.userCannotUpdateNonExistantDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/00005.002?' + userCred,
    body: {data: {name: 'I should not be saved'}}
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}

exports.adminCannotUpdateNonExistantDoc = function(test) {
  var req = new Req({
    uri: '/data/documents/00005.002?' + adminCred,
    body: {data: {name: 'I should should not be saved'}}
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}


exports.canAddDocsWithPreexitingIds = function(test) {
  var newDocId1 = '0005.060101.55664.234.11111'
  var newDocId2 = '0005.060101.55664.234.22222'
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: newDocId1, name: 'I have my own id'}}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data._id)
    assert(res.body.data._id === newDocId1)
    var req2 = new Req({
      uri: '/data/documents?' + userCred,
      body: {data: {_id: newDocId2, name: 'I do too'}}
    })
    request(req2, function(err, res) {
      check(req2, res, 201)
      test.done()
    })
  })
}


exports.cannotAddDocWithMissMatchedTableId = function(test) {
  var req = new Req({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: '0004.060101.55664.234.34567', name: 'I have my own id'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}

exports.cannotLinkDocToBogusTableId = function(test) {
  var req = new Req({
    uri: '/data/links?' + userCred,
    body: {data: {_from: testDoc1._id,
     _to: 'foo.120101.673423.654.23423'}}
  })
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}


exports.userCanLinkDocs = function(test) {
  var req = new Req({
    uri: '/data/links?' + userCred,
    body: {data: {_from: testDoc1._id,
     _to: testDoc2._id}}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    linkId = res.body.data._id
    test.done()
  })
}


exports.checkLink = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/links/' + linkId
  })
  request(req, function(err, res) {
    check(req, res) 
    assert(res.body.data[0]._from = testDoc1._id)
    assert(res.body.data[0]._to = testDoc2._id)
    assert(res.body.data[0].fromTableId = documentsSchemaId)
    assert(res.body.data[0].toTableId = documentsSchemaId)
    test.done()
  })
}


exports.canDeleteLink = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/links/' + linkId + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res) 
    assert(res.body.count = 1)
    test.done()
  })
}



exports.userCannotDeleteUsingWildcard = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/*?' + userCred
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}


exports.userCanDeleteMultipleDocs = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res) 
    assert(res.body.count === 2) 
    test.done()
  })
}


exports.defaultsWork = function(test) {
  var req = new Req({
    uri: '/data/beacons?' + userCred,
    body: {data: {
      bssid: '01:10:11:22:44:66',
      ssid: 'Rest test beacon'
    }}
  })
  request(req, function(err, res){
    check(req, res, 201)
    assert(res.body.data.visibility === 'public')
    test.done()
  })
}


exports.adminCanDeleteAllUsingWildcard = function(test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/*?' + adminCred
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count >= 1)
    var req2 = new Req({
      method: 'get',
      uri: '/data/beacons?' + adminCred
    })
    request(req2, function(err, res) {
      check(req, res)
      assert(res.body.data.length === 0)
      test.done()
    })
  })
}


exports.countByWorks = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/entities?countBy=_owner'
  })
  request(req, function(err, res) {
    check(req, res)
    // These are based on data in template test database
    assert(res.body.count >= 10, dump(req, res))
    assert(res.body.data[0].countBy === 300, dump(req, res))
    test.done()
  })
}

