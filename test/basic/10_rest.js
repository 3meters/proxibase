/*
 *  Proxibase rest basic test
 */

var util = require('proxutils')
var log = util.log
var tipe = util.tipe
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var userSession
var userCred
var userId
var adminSession
var adminCred
var adminId
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

function removeDoc(id, cred, cb) {
  if (arguments.length === 2) {
    cb = cred
    cred = adminCred
  }
  t.del({uri: '/data/documents/' + id + '?' + cred}, cb)
}

exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userId = session._owner
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminId = session._owner
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.genIdWorks = function(test) {
  t.get('/data/patches/genId',
  function(err, res, body) {
    t.assert(body.data._id)
    var schemaId = body.data._id.split('.')[0]
    t.assert(schemaId)
    t.assert(schemaId === util.statics.schemas.patch.id)
    test.done()
  })
}

exports.genIdBeacons = function(test) {
  t.get('/data/beacons/genId?bssid=00:11:22:33:44',
  function(err, res, body) {
    t.assert(body.data._id)
    t.assert(body.data._id === util.statics.schemas.beacon.id + '.00:11:22:33:44')
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

exports.canPostMultipleDocumentsInArray = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: [
      { name: 'RestTestMultiDoc0', },
      { name: 'RestTestMultiDoc1', }
    ]}
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === 2)
    t.assert(body.count === 2)
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
    t.assert(doc.createdIp)
    t.assert(doc.modifiedDate)
    t.assert(doc.modifiedIp)
    t.assert(doc.createdDate === doc.modifiedDate)
    t.assert(doc.schema)
    t.assert(!doc.collection)  // old system field
    // proves timestamp of _id matches created date
    t.assert(getTimeString(doc._id) === getTimeString(util.genId('do', doc._createdDate)))
    testDoc1._id = doc._id
    test.done()
  })
}

exports.fieldsParamWorks = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + '?fields=name&' + userCred
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.name)
    t.assert(!body.data.data)
    test.done()
  })
}

exports.canAddDoc2 = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: testDoc2}
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data._id)
    testDoc2._id = body.data._id
    test.done()
  })
}


exports.cannotUpdateSinglePropertyOfNestedObject = function(test) {
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
    t.assert(body.data.data.number === 3)
    t.assert(!body.data.data.foo)
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
    t.assert(tipe.isUndefined(body.data.data.foo))
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
    t.assert(tipe.isUndefined(body.data.data))
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
  t.post({
    uri: '/data/beacons?' + userCred,
    body: {data: {name: 'Test beacon missing required bssid field'}}
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1) // missingParam
    test.done()
  })
}


exports.findDocsByIdsAndCheckSysFields = function(test) {
  t.get({
    uri: '/data/documents/' + testDoc1._id + ',' + testDoc2._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.data.length)
    t.assert((body.data[0]._id === testDoc1._id || body.data[1]._id === testDoc1._id))
    t.assert(body.data[0]._creator === userSession._owner)
    t.assert(body.data[0]._owner === userSession._owner)
    t.assert(body.data[0].createdDate > testStartTime)
    t.assert(body.data[0].modifiedDate > testStartTime)
    testDoc1Saved = body.data[0]
    test.done()
  })
}


exports.findDocsByQ = function(test) {
  t.get({
    uri: '/data/documents?q[_id]=' + testDoc1._id + '&' + userCred
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    test.done()
  })
}

exports.findDocsByGetAndFindAndJsonFailsWithBadUserCred = function(test) {
  t.get({
    // bogus session key
    uri: '/data/documents?q[_id]' + testDoc1._id + '&' + userCred.slice(0, -1)
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.findDocsByName = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name.toUpperCase() + '&' + userCred + '&log=true'
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.findDocsByNameStartsWithMatch = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name.slice(0, testDoc1.name.length -2) + '&' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 2)
    test.done()
  })
}


exports.findWithRefs = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name + '&refs=name&' + userCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    var doc = body.data[0]
    t.assert(/^Test User/.test(doc.owner))
    t.assert(/^Test User/.test(doc.creator))
    t.assert(/^Test User/.test(doc.modifier))
    test.done()
  })
}


exports.findWithRefsDefaultsToName = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name + '&refs=1&' + userCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    var doc = body.data[0]
    t.assert(doc._owner && tipe.isString(doc.owner))
    t.assert(doc._creator && tipe.isString(doc.creator))
    t.assert(doc._modifier && tipe.isString(doc.modifier))
    test.done()
  })
}


exports.findWithRefsSetToEmptyObjectNestsEntireDocument = function(test) {
  t.post({
    uri: '/find/documents?name=' + testDoc1.name + '&' + userCred,
    body: {
      refs: {},
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    var doc = body.data[0]
    t.assert(doc)
    t.assert(doc._owner && tipe.isObject(doc.owner))
    t.assert(doc._creator && tipe.isObject(doc.creator))
    t.assert(doc._modifier && tipe.isObject(doc.modifier))
    t.assert(doc.owner._id)
    t.assert(doc.owner.name)
    t.assert(doc.owner._owner)
    test.done()
  })
}

exports.findWithRefsNestedObjectFieldList = function(test) {
  t.get({
    uri: '/data/documents?name=' + testDoc1.name + '&refs=_id,name,photo&' + userCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    var doc = body.data[0]
    t.assert(doc.owner && doc.owner._id && doc.owner.name)
    t.assert(!doc.owner.role)   // not included in list
    t.assert(doc.creator && doc.creator._id && doc.creator.name)
    t.assert(doc.creator && doc.creator.photo && doc.creator.photo.prefix)
    t.assert(doc.modifier && doc.modifier._id && doc.modifier.name)
    t.assert(doc.modifier && doc.modifier.photo && doc.modifier.photo.prefix)
    test.done()
  })
}


exports.refOnLinksDontShowDataYouCannotSee = function(test) {
  t.get({
    uri: '/find/links?refs=name,email,role&sort[modifiedDate]=1&limit=5&q[toSchema]=patch&q[fromSchema]=user&' + userCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(link) {
      t.assert(link.to)
      t.assert(link.to.name)
      t.assert(!link.to.email)
      t.assert(!link.to.role)
      t.assert(link.from)
      t.assert(link.from.name)
      t.assert(!link.from.email)
      t.assert(!link.from.role)
    })
    test.done()
  })
}


exports.refOnLinksWorkSingleFieldSyntax = function(test) {
  t.get({
    uri: '/find/links?refs=name&sort[modifiedDate]=1&limit=5&' + adminCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(link) {
      t.assert(tipe.isString(link.to))
      t.assert(tipe.isString(link.from))
    })
    test.done()
  })
}


exports.refsWithMixedSignatureWorks = function(test) {
  t.get({
    uri: '/find/links?refs[_owner]=name,photo,schema&refs[_modifier]=name&sort[modifiedDate]=1&limit=5&' + adminCred
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(link) {
      t.assert(!link.to)
      t.assert(!link.from)
      t.assert(tipe.isObject(link.owner))
      t.assert(tipe.isString(link.owner.name))
      t.assert(tipe.isObject(link.owner.photo))
      t.assert(tipe.isString(link.owner.schema))
      t.assert(tipe.isString(link.modifier))  // If you only specify a single field you will get it, not a nested object
    })
    test.done()
  })
}


exports.refsQueryUsingPostWorks = function(test) {
  t.post({
    uri: '/find/links?' + adminCred,
    body: {
      sort: 'modifiedDate',
      limit: 5,
      refs: {
        _owner: 'name,photo,schema',
        _modifier: {name: 1, photo: true},  // alt sytax
        _to: {},   // empty object means return all fields
        _from: 1,   // true means return just the name as a top level string
      }
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(link) {
      t.assert(tipe.isObject(link.to))
      t.assert(link.to.name)                // nested object with all fields
      t.assert(link.to._owner)
      t.assert(tipe.isString(link.from))    // top level string, not object
      t.assert(tipe.isObject(link.owner))
      t.assert(tipe.isString(link.owner.name))
      t.assert(tipe.isObject(link.owner.photo))
      t.assert(tipe.isString(link.owner.schema))
      t.assert(tipe.isObject(link.modifier))
      t.assert(tipe.isString(link.modifier.name))
      t.assert(tipe.isObject(link.modifier.photo))
      t.assert(tipe.isUndefined(link.modifier.schema))
    })
    test.done()
  })
}


exports.refsQueryWithUnknowMixedSignatureFails = function(test) {
t.post({
    uri: '/find/links?' + adminCred,
    body: {
      sort: 'modifiedDate',
      limit: 5,
      refs: {
        _owner: 'name,photo,schema',
        _modifier: {name: 1, photo: true},  // alt sytax
        _to: {},   // empty object means return all fields
        _from: 1,   // true means return just the name as a top level string
        name: 1,    // not a valid ref field
      }
    }
  }, 400, function(err, res, body) {
    t.assert(body.error)
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
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
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
    t.assert(tipe(body.data.name === 'undefined'))
    t.assert(tipe(body.data.data === 'undefined'))
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

exports.userUpdatesNonExistantDocSucceedsWithZeroCount = function(test) {
  t.post({
    uri: '/data/documents/00005.002?' + userCred,
    body: {data: {name: 'I should not be saved'}}
  }, function(err, res, body) {
    t.assert(body.data === undefined)
    t.assert(body.count === 0)
    test.done()
  })
}

exports.adminUpdatesNonExistantDocSucceedsWithZeroCount = function(test) {
  t.post({
    uri: '/data/documents/00005.002?' + adminCred,
    body: {data: {name: 'I should should not be saved'}}
  }, function(err, res, body) {
    t.assert(body.data === undefined)
    t.assert(body.count === 0)
    test.done()
  })
}

exports.canAddDocsWithPreexitingIds = function(test) {
  var newDocId1 = 'do.' + util.seed()
  var newDocId2 = 'do.' + util.seed()
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
      removeDoc(newDocId1, function() {
        removeDoc(newDocId2, function() {
          test.done()
        })
      })
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
     _to: testDoc2._id, type: 'content'}}
  }, 201, function(err, res, body) {
    linkId = body.data._id
    test.done()
  })
}

exports.checkLink = function(test) {
  t.get({
    uri: '/data/links/' + linkId  // not owner access, fully readable, ok?
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


exports.userCanDeleteSingleDoc = function(test) {
  t.del({
    uri: '/data/documents/' + testDoc1._id + '?' + userCred
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.del({
      uri: '/data/documents/' + testDoc2._id + '?' + userCred
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
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
    removeDoc(body.data._id, function() {
      test.done()
    })
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
    t.assert(tipe.isUndefined(data.name))
    t.assert(data.data.p1 === 1)
    t.assert(tipe.isUndefined(data.data.p2))
    removeDoc(data._id, function() {
      test.done()
    })
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

exports.adminCanReadSystemCollections = function(test) {
  t.get({uri: '/data/sessions?' + adminCred}, function(err, res, body) {
    t.assert(body.data.length)
    test.done()
  })
}

exports.countByFailsOnBogusFields = function(test) {
  t.get({
    uri: '/data/beacons/count/_foo,bar'
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11)
    test.done()
  })
}

exports.deleteNonExistantRecordSucceedsWithZeroCount = function(test) {
  t.del({uri: '/data/beacons/bogusid1?' + adminCred}, function(err, res, body) {
    t.assert(body.count === 0)
    t.get('/data/beacons/bogusid1', function(err, res, body) {
      t.assert(null === body.data)
      test.done()
    })
  })
}

exports.deleteWithNoIdFailsWithError = function(test) {
  t.del({uri: '/data/beacons?' + adminCred}, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.code === 400.1)  // missing required, used to be not found
    test.done()
  })
}

exports.canDeleteLinkUsing__to__from_typeQuery = function(test) {
  var linkId
  t.post({
    uri: '/data/links?' + userCred,
    body: {
      data: {
        _to: adminId,
        _from: userId,
        type: 'like'
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    var linkId = body.data._id
    t.assert(linkId)
    t.delete({uri: '/data/links?query[_to]=' + adminId + '&query[_from]=' + userId +
        '&query[type]=like&' + userCred},
    function(err, res, body) {
      t.assert(body.count === 1)
      t.get('/data/links/' + linkId + '?' + userCred,
      function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}

exports.sortsDescendingByModifiedDateByDefault = function(test) {
  t.get('/data/beacons',
  function(err, res, body) {
    docs = body.data
    t.assert(docs && docs.length)
    var modDate = Infinity
    docs.forEach(function(doc) {
      t.assert(modDate >= doc.modifiedDate)
      modDate = doc.modifiedDate
    })
    test.done()
  })
}

exports.sortWorks = function(test) {
  t.get('/data/patches?sort[0][_id]=-1',
  function(err, res, body) {
    var lastId = 'pa.999999.99999.999.999999'
    body.data.forEach(function(patch, i) {
      t.assert(patch._id < lastId, i)
      lastId = patch._id
    })
    test.done()
  })
}

exports.sortAltFormatWorks = function(test) {
  t.get('/data/patches?sort[0][0]=namelc&sort[0][1]=asc',
  function(err, res, body) {
    var namelc = 'a'
    body.data.forEach(function(patch, i) {
      t.assert(patch.namelc > namelc, i)
      namelc = patch.namelc
    })
    test.done()
  })
}

exports.sortAltFormat2Works = function(test) {
  t.get('/data/patches?sort=_owner,-namelc',
  function(err, res, body) {
    var namelc, _owner = ''
    body.data.forEach(function(patch, i) {
      if (patch._owner !== _owner) {
        t.assert(patch._owner > _owner, i)
        _owner = patch._owner
        namelc = 'zzzzzzzzzzzzzzzzzzzzzzzz'
      }
      if (patch.namelc !== namelc) {
        t.assert(patch.namelc < namelc, i)
        namelc = patch.namelc
      }
    })
    test.done()
  })
}

exports.countWorks = function(test) {
  t.get('/data/patches/count',
  function(err, res, body) {
    t.assert(body.count)
    test.done()
  })
}

exports.formatDatesUtcWorks = function(test) {
  t.get('/data/patches?utc=1',
  function(err, res, body) {
    t.assert(tipe.isString(body.data[1].createdDate))
    t.assert(tipe.isString(body.data[1].modifiedDate))
    test.done()
  })
}

// Try a complicated query and set timeout to 1 milisecond
exports.readTimeoutWorks = function(test) {
  t.get('/find/links?limit=10000&skip=500&sort=-_modifier&refs=true&timeout=1&' + userCred,
  510, function (err, res, body) { // server error: timeout
    test.done()
  })
}
