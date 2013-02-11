/*
 *  Proxibase rest basic test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var userSession
var userCred
var adminSession
var adminCred
var documentsSchemaId = 5  // will break if we change schemaIds
var testDoc1 = {
  name: 'Test Rest Doc 1',
  data: { foo: 'bar', number: 1 }
}
var testDoc1Saved = {}
var testDoc2 = {
  name: 'Test Rest Doc 2',
  data: { foo: 'bar', number: 2 }
}
var linkId
var testStartTime = util.getTimeUTC()
var _exports = {}  // For commenting out tests


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
  t.post({
    uri: '/data/documents?' + userCred,
    body: {'name': 'ForgotToEncloseDataInDataTag'}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.cannotPostWithMultipleArrayElements = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: [
      { name: 'RestTestMultiDoc0', },
      { name: 'RestTestMultiDoc1', }
    ]}
  }, 400, function(err, res, body) {
    test.done()
  })
}


// TODO: only enforced by REST.  Custom methods bypass
exports.cannotPostWithNonSchemaFields = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: {name: 'I make up fields', myField: 'foo'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11) // Bad parameter
    test.done()
  })
}


exports.canAddDoc = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc1}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    testDoc1._id = body.data._id
    test.done()
  })
}


exports.canAddDocAsSingleElementArray = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc2}
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data._id)
    testDoc2._id = body.data._id
    test.done()
  })
}

exports.cannotAddDocMissingRequiredField = function(test) {
  t.post({
    uri: '/data/entities?' + userCred,
    body: {data: {name: 'Test Entity Missing its type'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1) // missingParam
    test.done()
  })
}

exports.findDocsByIdAndCheckSysFields = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert((body.data[0]._id === testDoc1._id || body.data[1]._id === testDoc1._id))
    t.assert((body.data[0].name === testDoc2.name || body.data[1].name === testDoc2.name))
    t.assert(body.data[0]._creator === userSession._owner)
    t.assert(body.data[0]._owner === userSession._owner)
    t.assert(body.data[0].createdDate > testStartTime)
    t.assert(body.data[0].modifiedDate > testStartTime)
    testDoc1Saved = body.data[0]
    test.done()
  })
}



exports.findDocsByGetAndFindAndJson = function(test) {
  t.get({
    uri: '/data/documents?find={"_id":"' + testDoc1._id + '"}&' + userCred
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    test.done()
  })
}

exports.findDocsByGetAndFindAndJsonFailsWithBadUserCred = function(test) {
  t.get({
    // bogus session key
    uri: '/data/documents?find={"_id":"' + testDoc1._id + '"}&' + userCred.slice(0, -1)
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.findDocsByGetAndFindWithBadJson = function(test) {
  t.get({
    uri: '/data/documents?find={_id:"' + testDoc1._id + '"}&' + userCred
  }, 400, function(err, res, body) {
    test.done()
  })
}

exports.findDocsByNameWhenNotSignedIn = function(test) {
  t.get({
    uri: '/data/documents?names=' + testDoc1.name.toUpperCase() + ',' + testDoc2.name
  }, function(err, res, body) {
    t.assert(body.count === 2)
    test.done()
  })
}

exports.findWithLookups = function(test) {
  t.get({
    uri: '/data/documents?names=' + testDoc1.name + '&lookups=1'
  }, function(err, res, body) {
    var doc = body.data[0]
    t.assert('Test User' === doc.owner)
    t.assert('Test User' === doc.creator)
    t.assert('Test User' === doc.modifier)
    test.done()
  })
}



exports.updateDoc = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
    body: {data: {name: 'Changed Name' } }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data.name)
    t.assert(body.data.name === 'Changed Name')
    test.done()
  })
}


exports.checkUpdatedDoc = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id
  }, function(err, res, body) {
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].name === 'Changed Name')
    // Ensures modified date is getting set on update
    t.assert(body.data[0].modifiedDate > testDoc1Saved.modifiedDate)
    test.done()
  })
}

exports.settingFieldsToNullUnsetsThem = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
    body: {data: {data: null} }
  }, function(err, res, body) {
    t.assert(util.type(body.data.data === 'undefined'))
    test.done()
  })
}


exports.cannotAddNonSchemaFieldsUsingUpdate = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
    body: {data: {myNewField: 'Should fail' } }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11) // Bad parameter
    test.done()
  })
}


exports.deleteUpdateDoc = function(test) {
  t.del({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}


exports.checkUpdatedDocDeletedThenAddBack = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 0)
    t.post({
      uri: '/data/documents?' + userCred,
      body: {data: testDoc1}
    }, 201, function(err, res, body) {
      t.assert(body.data._id = testDoc1._id)
      test.done()
    })
  })
}

exports.userCannotUpdateNonExistantDoc = function(test) {
  t.post({
    uri: '/data/documents/00005.002?' + userCred,
    body: {data: {name: 'I should not be saved'}}
  }, 404, function(err, res, body) {
    test.done()
  })
}

exports.adminCannotUpdateNonExistantDoc = function(test) {
  t.post({
    uri: '/data/documents/00005.002?' + adminCred,
    body: {data: {name: 'I should should not be saved'}}
  }, 404, function(err, res, body) {
    test.done()
  })
}


exports.canAddDocsWithPreexitingIds = function(test) {
  var newDocId1 = '0007.060101.55664.234.11111'
  var newDocId2 = '0007.060101.55664.234.22222'
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: newDocId1, name: 'I have my own id'}}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    t.assert(body.data._id === newDocId1)
    t.post({
      uri: '/data/documents?' + userCred,
      body: {data: {_id: newDocId2, name: 'I do too'}}
    }, 201, function(err, res, body) {
      test.done()
    })
  })
}


exports.cannotAddDocWithMissMatchedTableId = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: '0005.060101.55664.234.34567', name: 'My id points to the wrong collection'}}
  }, 400, function(err, res, body) {
    test.done()
  })
}

exports.cannotLinkDocToBogusTableId = function(test) {
  t.post({
    uri: '/data/links?' + userCred,
    body: {data: {_from: testDoc1._id,
     _to: 'foo.120101.673423.654.23423'}}
  }, 400, function(err, res, body) {
    test.done()
  })
}


exports.userCanLinkDocs = function(test) {
  t.post({
    uri: '/data/links?' + userCred,
    body: {data: {_from: testDoc1._id,
     _to: testDoc2._id}}
  }, 201, function(err, res, body) {
    linkId = body.data._id
    test.done()
  })
}


exports.checkLink = function(test) {
  t.get({
    uri: '/data/links/' + linkId
  }, function(err, res, body) {
    t.assert(body.data[0]._from = testDoc1._id)
    t.assert(body.data[0]._to = testDoc2._id)
    t.assert(body.data[0].fromCollectionId = documentsSchemaId)
    t.assert(body.data[0].toCollectionId = documentsSchemaId)
    test.done()
  })
}


exports.canDeleteLink = function(test) {
  t.del({
    uri: '/data/links/' + linkId + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count = 1)
    test.done()
  })
}



exports.userCannotDeleteUsingWildcard = function(test) {
  t.del({ uri: '/data/documents/*?' + userCred }, 404,
  function(err, res, body) {
    test.done()
  })
}


exports.userCanDeleteMultipleDocs = function(test) {
  t.del({
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
    }, function(err, res, body) {
    t.assert(body.count === 2) 
    test.done()
  })
}


exports.defaultsWork = function(test) {
  t.post({
    uri: '/data/beacons?' + userCred,
    body: {data: {
      bssid: '01:10:11:22:44:66',
      ssid: 'Rest test beacon'
    }}
  }, 201, function(err, res, body) {
    t.assert(body.data.visibility === 'public')
    test.done()
  })
}

exports.anonCannotReadSystemCollections = function(test) {
  t.get({uri: '/data/sessions'}, 401, function(err, res, body) {
    test.done()
  })
}

exports.userCannotReadSystemCollections = function(test) {
  t.get({uri: '/data/sessions?' + userCred}, 401, function(err, res, body) {
    test.done()
  })
}

exports.admiCanReadSystemCollections = function(test) {
  t.get({uri: '/data/sessions?' + adminCred}, function(err, res, body) {
    t.assert(body.data.length)
    test.done()
  })
}

exports.usersCannotSkipSafeInsert = function(test) {
  t.post({
    uri: '/data/beacons?' + userCred,
    body: {
      data: {
        bssid: '01:10:11:22:44:88',
        bogusField: 'I am a bogus field'
      },
      skipValidation: true 
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminsCanSkipSafeInsert = function(test) {
  t.post({
    uri: '/data/beacons?' + adminCred,
    body: {
      data: {
        _id: 'bogusid1',
        bogusField: 'I am a bogus field'
      },
      skipValidation: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.data.bogusField)
    test.done()
  })
}

exports.usersCannotSkipSafeUpdate = function(test) {
  t.post({
    uri: '/data/beacons/bogusid1?' + userCred,
    body: {
      data: {
        bogusField2: 'I am a bogus field too'
      },
      skipValidation: true
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminsCanSkipSafeUpdate = function(test) {
  t.post({
    uri: '/data/beacons/bogusid1?' + adminCred,
    body: {
      data: {
        bogusField2: 'I am a bogus field too'
      },
      skipValidation: true
    }
  }, function(err, res, body) {
    t.assert(res.body.count === 1)
    t.assert(res.body.data === 1) // unsafe update does not return updated record
    test.done()
  })
}
exports.countByWorks = function(test) {
  t.get({
    uri: '/data/entities?countBy=_owner'
  }, function(err, res, body) {
    // These are based on data in template test database
    t.assert(res.body.count >= 10)
    t.assert(res.body.data[0].countBy === 300)
    test.done()
  })
}

// This has to be the last test because all subsequent logins will fail
// since it deletes all the sessions
exports.adminCanDeleteAllUsingWildcard = function(test) {
  t.del({
    uri: '/data/sessions/*?' + adminCred
  }, function(err, res, body) {
    t.assert(res.body.count >= 1)
    test.done()
  })
}

