/*
 *  Proxibase rest basic test
 */

var util = require('proxutils')
var log = util.log
var type = util.type
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

exports.genIdWorks = function(test) {
  t.get('/data/places?genId=1',
  function(err, res, body) {
    t.assert(body.data._id)
    var schemaId = body.data._id.split('.')[0]
    t.assert(schemaId)
    t.assert(schemaId === util.statics.schemas.place.id)
    test.done()
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
  function getTimeString(id) { return id.split('.').slice(1,1).join('.') }
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc1}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    var doc = body.data
    t.assert(doc && doc._id)
    t.assert(doc.createdDate)
    t.assert(doc.modifiedDate)
    t.assert(doc.createdDate === doc.modifiedDate)
    // proves timestamp of _id matches created date
    t.assert(getTimeString(doc._id) === getTimeString(util.genId('do', doc._createdDate)))
    testDoc1._id = doc._id
    test.done()
  })
}

exports.fieldsParamWorks = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + '?fields=name'
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.name)
    t.assert(!body.data.data)
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


exports.canUpdateSinglePropertyOfNestedObject = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc2._id + '?' + userCred,
    body: {
      data: {
        data: {
          number: 3
        }
      }
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.data)
    t.assert(body.data.data.foo === 'bar')
    t.assert(body.data.data.number === 3)
    test.done()
  })
}

exports.canRemovePropertyOfNestedObject = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc2._id + '?' + userCred,
    body: {
      data: {
        data: {
          number: 4,
          foo: null,
        }
      }
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.data)
    t.assert(body.data.data.number === 4)
    t.assert(util.type.isUndefined(body.data.data.foo))
    test.done()
  })
}

exports.updateCanRemoveNestedObjects = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc2._id + '?' + userCred,
    body: {
      data: {
        type: 'I have lost my data',
        data: null
      }
    }
  }, function(err, res, body) {
    t.assert(body.data.type === 'I have lost my data')
    t.assert(type.isUndefined(body.data.data))
    test.done()
  })
}

exports.updateCanCreatedNestedObject = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc2._id + '?' + userCred,
    body: {
      data: {
        type: 'I have found my data',
        data: {
          p1: 1,
        }
      }
    }
  }, function(err, res, body) {
    t.assert(body.data.data.p1 === 1)
    test.done()
  })
}

exports.cannotAddDocMissingRequiredField = function(test) {
  log('Skipped test')
  return test.done()
  t.post({
    uri: '/data/places?' + userCred,
    body: {data: {name: 'Test Entity Missing its type'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1) // missingParam
    test.done()
  })
}

// TODO:  reimplement targeting the devices collection
_exports.canUpdateNestedArrays = function(test) {
  t.post({
    uri: '/data/entities?' + userCred,
    body: {data: {
      type: util.statics.schemaPlace,
      name: 'Test Entity With Comments',
      comments: [
        {name: 'Comment 1', description: 'I am comment 1'},
        {name: 'Comment 2', description: 'I am comment 2'},
      ]
    }}
  }, 201, function(err, res, body) {
    var ent = body.data
    t.assert(ent.comments.length === 2)
    t.post({
      uri: '/data/entities/' + ent._id + '?' + userCred,
      body: {data: {
        name: null, // piggy-back test that nulling name deletes namelc
        comments: [
          {name: 'Comment 1', description: 'I am comment 1'},
          {name: 'Comment 2', description: 'I am new comment 2'},
        ]
      }}
    }, function(err, res, body) {
      var ent = body.data
      t.assert(ent._id && ent.type && ent.comments)
      t.assert(type.isUndefined(ent.name))
      t.assert(type.isUndefined(ent.namelc))
      t.assert(ent.comments[0].description === 'I am comment 1')
      t.assert(ent.comments[1].description === 'I am new comment 2')
      t.delete({
        uri: '/data/entities/' + ent._id + '?' + userCred
      }, function(err, res) {
        test.done()
      })
    })
  })
}

exports.findDocsByIdAndCheckSysFields = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert((body.data[0]._id === testDoc1._id || body.data[1]._id === testDoc1._id))
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
    uri: '/data/documents?filter={"_id":"' + testDoc1._id + '"}&' + userCred
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    test.done()
  })
}

exports.findDocsByGetAndFindAndJsonFailsWithBadUserCred = function(test) {
  t.get({
    // bogus session key
    uri: '/data/documents?filter={"_id":"' + testDoc1._id + '"}&' + userCred.slice(0, -1)
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.findDocsByGetAndFindWithBadJson = function(test) {
  t.get({
    uri: '/data/documents?filter={"_id:"' + testDoc1._id + '"}&' + userCred
  }, 400, function(err, res, body) {
    test.done()
  })
}

exports.findDocsByNameWhenNotSignedIn = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name.toUpperCase()
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.findDocsByNameStartsWithMatch = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name.slice(0, testDoc1.name.length -2)
  }, function(err, res, body) {
    t.assert(body.count === 2)
    test.done()
  })
}

exports.findWithLookups = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name + '&lookups=1'
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
    t.assert(body.data && body.data)
    t.assert(body.data.name === 'Changed Name')
    // Ensures modified date is getting set on update
    t.assert(body.data.modifiedDate > testDoc1Saved.modifiedDate)
    test.done()
  })
}

exports.settingFieldsToNullUnsetsThem = function(test) {
  t.post({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred,
    body: {name: null, data: {data: null} }
  }, function(err, res, body) {
    t.assert(util.type(body.data.name === 'undefined'))
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
  var newDocId1 = 'do.060101.55664.234.11111'
  var newDocId2 = 'do.060101.55664.234.22222'
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
    body: {data: {_id: '1.060101.55664.234.34567', name: 'My id points to the wrong collection'}}
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
    t.assert(body.data._from = testDoc1._id)
    t.assert(body.data._to = testDoc2._id)
    t.assert(body.data.fromCollectionId = documentsSchemaId)
    t.assert(body.data.toCollectionId = documentsSchemaId)
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

exports.customGenIdsWork = function(test) {
  var bssid = '01:10:11:22:44:66'
  t.post({
    uri: '/data/beacons?' + adminCred,
    body: {
      data: {
        bssid: bssid,
        ssid: 'Rest test beacon',
      }
    }
  }, 201, function(err, res, body) {
    t.assert('be.' + bssid === body.data._id)
    t.assert(body.data.enabled === true)  // proves defaults work
    test.done()
  })
}

exports.nullsAreNotPersistedOnInsert = function(test) {
  t.post({
    uri: '/data/documents?' + userCred, 
    body: {
      data: {
        name: null,
        data: {
          p1: 1,
          p2: null,
        }
      }
    }
  }, 201, function(err, res, body) {
    var data = body.data
    t.assert(util.type.isUndefined(data.name))
    t.assert(data.data.p1 === 1)
    t.assert(util.type.isUndefined(data.data.p2))
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
        _id: 'bogusid1',
        type: util.statics.schemaBeacon,
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
        type: util.statics.schemaBeacon,
        bssid: '01:10:11:22:44:88',
        bogusField: 'I am a bogus field'
      },
      skipValidation: true 
    }
  }, 201, function(err, res, body) {
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
    t.assert(body.count === 1)
    t.assert(body.data === 1) // unsafe update does not return updated record
    test.done()
  })
}

exports.countByFailsOnBogusFields = function(test) {
  t.get({
    uri: '/data/beacons?countBy=_foo,bar'
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11)
    test.done()
  })
}

exports.deleteBogusRecord = function(test) {
 t.delete({
    uri: '/data/beacons/bogusid1?' + adminCred,
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.sortsDescendingByModifiedDateByDefault = function(test) {
  t.get('/data/documents',
  function(err, res, body) {
    docs = body.data
    t.assert(docs && docs.length)
    var modDate = Infinity
    docs.forEach(function(doc) {
      t.assert(modDate > doc.modifiedDate)
      modDate = doc.modifiedDate
    })
    test.done()
  })
}

exports.sortWorks = function(test) {
  t.get('/data/users?sort[0][_id]=-1',
  function(err, res, body) {
    var lastId = 'us.999999.99999.999.999999'
    body.data.forEach(function(user, i) {
      t.assert(user._id < lastId, i)
      lastId = user._id
    })
    test.done()
  })
}

exports.sortAltFormatWorks = function(test) {
  t.get('/data/users?sort[0][0]=namelc&sort[0][1]=asc',
  function(err, res, body) {
    var namelc = 'a'
    body.data.forEach(function(user, i) {
      t.assert(user.namelc > namelc, i)
      namelc = user.namelc
    })
    test.done()
  })
}

exports.formatDatesWorks = function(test) {
  t.get('/data/users?datesToUTC=1',
  function(err, res, body) {
    t.assert(util.type.isString(body.data[1].createdDate))
    t.assert(util.type.isString(body.data[1].modifiedDate))
    test.done()
  })
}

// This has to be the last test because all subsequent logins will fail
// since it deletes all the sessions
exports.adminCanDeleteAllUsingWildcard = function(test) {
  t.del({
    uri: '/data/sessions/*?' + adminCred
  }, function(err, res, body) {
    t.assert(body.count >= 1)
    test.done()
  })
}
