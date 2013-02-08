/**
 *  Proxibase custom methods test
 */

var util = require('utils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCred
var user2Cred
var adminCred
var primaryLink
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var testLatitude2 = 47.1
var testLongitude2 = -122.1
var radiusTiny = (0.000001 / 3959)
var radiusBig = (10 / 3959)
var testUser = {
  _id : "0001.111111.11111.111.111111",
  name : "John Q Test",
  email : "johnqtest@3meters.com",
  password : "12345678",
  photo: {prefix:"resource:placeholder_user", format:"binary", sourceName:"aircandi"},
  location : "Testville, WA",
  isDeveloper : false
}
var testUser2 = {
  _id : "0001.111111.11111.111.222222",
  name : "John Q Test2",
  email : "johnqtest2@3meters.com",
  password : "12345678"
}
var testEntity = {
  _id : "0004.111111.11111.111.111111",
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", format:"binary", sourceName:"aircandi"},
  signalFence : -100,
  name : "Testing candi",
  type : "com.aircandi.candi.picture",
  visibility : "public",
  isCollection: false,
  enabled : true,
  locked : false
}
var testEntity2 = {
  _id : "0004.111111.11111.111.111112",
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", format:"binary", sourceName:"aircandi"},
  signalFence : -100,
  name : "Testing candi 2",
  type : "com.aircandi.candi.place",
  place: {location:{lat:testLatitude, lng:testLongitude}},
  visibility : "public",
  isCollection: true,
  enabled : true,
  locked : false
}
var testEntity3 = {
  _id : "0004.111111.11111.111.111113",
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", format:"binary", sourceName:"aircandi"},
  signalFence : -100,
  name : "Testing candi 3",
  type : "com.aircandi.candi.place",
  place: {location:{lat:testLatitude, lng:testLongitude}},
  visibility : "public",
  isCollection: true,
  enabled : true,
  locked : false
}
var testLink = {
  _to : '0008.11:11:11:11:11:22',
  _from : '0004.111111.11111.111.111111',
  primary: true,
  signal: -100
}
var newTestLink = {
  _to : '0004.111111.11111.111.111112',
  _from : '0004.111111.11111.111.111111',
  primary: true,
  signal: -100
}
var testBeacon = {
  _id : '0008.11:11:11:11:11:11',
  label: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '11:11:11:11:11:11',
  beaconType: 'fixed',
  visibility: 'public',
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 12,
  accuracy : 30,
  level: -80,
  loc : [testLongitude, testLatitude]
}
var testBeacon2 = {
  _id : '0008.22:22:22:22:22:22',
  label: 'Test Beacon Label 2',
  ssid: 'Test Beacon 2',
  bssid: '22:22:22:22:22:22',
  beaconType: 'fixed',
  visibility: 'public',
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 12,
  accuracy : 30,
  level: -85,
  loc : [testLongitude, testLatitude]
}
var testBeacon3 = {
  _id : '0008.33:33:33:33:33:33',
  label: 'Test Beacon Label 3',
  ssid: 'Test Beacon 3',
  bssid: '33:33:33:33:33:33',
  beaconType: 'fixed',
  visibility: 'public',
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 12,
  accuracy : 30,
  level: -95,
  loc : [testLongitude, testLatitude]
}
var testObservation = {
  latitude : testLatitude,
  longitude : testLongitude,
  altitude : 100,
  accuracy : 50.0
}
var testObservation2 = {
  latitude : testLatitude2,
  longitude : testLongitude2,
  altitude : 12,
  accuracy : 30.0
}
var testObservation3 = {
  latitude : 46.15,
  longitude : -121.1,
  altitude : 12,
  accuracy : 30.0
}
var testComment = {
  title : "Test Comment",
  description : "Test comment, much ado about nothing.",
  name : "John Q Test",
  location : "Testville, WA",
  imageUri : "resource:placeholder_user",
  _creator : testUser._id
}

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(testUser, function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getUserSession(testUser2, function(session) {
      user2Cred = 'user=' + session._owner + '&session=' + session.key
      testUtil.getAdminSession(function(session) {
        adminCred = 'user=' + session._owner + '&session=' + session.key
        test.done()
      })
    })
  })
}

exports.getEntitiesLoadChildren = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities',
    body: {entityIds: [constants.entityId], 
        eagerLoad: {parents: false, children: true, comments: true}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.children.length === dbProfile.spe)
    t.assert(record.childCount === dbProfile.spe)
    t.assert(record.comments.length === dbProfile.cpe)
    t.assert(record.commentCount === dbProfile.cpe)
    t.assert(record.links[0]._to === constants.beaconId)
    test.done()
  })
}

exports.getEntitiesForLocation = function (test) {
  t.post({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[constants.beaconId],eagerLoad:{children:true,comments:false}}
  }, function(err, res, body) {
    t.assert(body.count === dbProfile.epb)
    t.assert(body.date)
    test.done()
  })
}

exports.getEntitiesForLocationLimited = function (test) {
  t.post({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[constants.beaconId], 
        eagerLoad:{ children:true,comments:false }, 
        options:{limit:3, skip:0, sort:{modifiedDate:-1}}}
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === true)
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  t.post({
    uri: '/do/getEntitiesForUser',
    body: {userId:constants.uid1, eagerLoad:{children:false,comments:false}}
  }, function(err, res, body) {
    t.assert(body.count === Math.min(constants.recordLimit,
        dbProfile.beacons * dbProfile.epb / dbProfile.users))
    test.done()
  })
}


exports.cannotInsertEntityNotLoggedIn = function (test) {
  t.post({
    uri: '/do/insertEntity',
    body: {
      entity:testEntity, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.insertEntity = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0]._id)

    /* Find and store the primary link that was created by insertEntity */
    t.post({
      uri: '/do/find',
      body: {table:'links',find:{_to:testBeacon._id, _from:body.data._id, primary:true}}
    }, function(err, res, body) {
      t.assert(body.count === 1)
      primaryLink = body.data[0]
      test.done()
    })
  })
}

exports.checkInsertEntity = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity._id}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertEntityLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'actions',find:{_target:testEntity._id, type:'insert_entity_picture'}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertLinkLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'actions',find:{_target:primaryLink._id, type:'link_browse'}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.insertEntityBeaconAlreadyExists = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity2, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0]._id)
    test.done()
  })
}

exports.checkInsertEntityBeaconAlreadyExists = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity2._id}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertLinkToEntity = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon._id}}
  }, function(err, res, body) {
    t.assert(body.count === 2)
    test.done()
  })
}

exports.checkInsertBeacon = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'beacons', find:{ _id:testBeacon._id }}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    // Beacons should be owned by admin
    t.assert(body.data[0]._owner === util.adminUser._id)
    // Creator and modifier should be user who first added them
    t.assert(body.data[0]._creator === testUser._id)
    t.assert(body.data[0]._modifier === testUser._id)
    test.done()
  })
}

exports.insertEntityWithNoLinks = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity3,
      observation:testObservation
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertEntityNoLinks = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity3._id}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0] && body.data[0].place)
    t.assert(body.data[0].place.location)
    t.assert(body.data[0].place.location.lat && body.data[0].place.location.lng)
    t.assert(body.data[0].loc)
    test.done()
  })
}

exports.getEntitiesForLocationIncludingNoLinkBigRadius = function (test) {
  t.post({
    uri: '/do/getEntitiesForLocation',
    body: {
      beaconIdsNew:[testBeacon._id], 
      eagerLoad:{children:true,comments:false}, 
      observation:testObservation3, 
      radius: radiusBig 
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.date)
    test.done()
  })
}

exports.getEntitiesForLocationIncludingNoLinkTinyRadius = function (test) {
  t.post({
    uri: '/do/getEntitiesForLocation',
    body: {
      beaconIdsNew:[testBeacon._id], 
      eagerLoad:{children:true,comments:false}, 
      observation:testObservation3, 
      radius: radiusTiny
    }
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.date)
    test.done()
  })
}

exports.trackEntityBrowse = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      beacons:[testBeacon, testBeacon2, testBeacon3], 
      primaryBeaconId:testBeacon2._id,
      observation:testObservation,
      actionType:'browse'
    }
  }, function(err, res, body) {
    test.done()
  })
}

exports.checkTrackEntityBrowseAddedBeacon2 = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'beacons', find:{_id:testBeacon2._id}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkTrackEntityBrowseLinksFromEntity1 = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links', find:{_from:testEntity._id, type:'browse'}}
  }, function(err, res, body) {
    t.assert(body.count === 3)
    test.done()
  })
}

exports.checkTrackEntityBrowseLinkFromEntity1ToBeacon2 = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon2._id, _from:testEntity._id, type:'browse'}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].primary === true)
    t.assert(body.data[0].signal === testBeacon2.level)
    test.done()
  })
}

exports.trackEntityProximity = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      beacons:[testBeacon, testBeacon2, testBeacon3], 
      primaryBeaconId:testBeacon2._id,
      observation:testObservation,
      actionType:'proximity'
    }
  }, function(err, res, body) {
    // give the fire-and-forget query some time to finish writing
    setTimeout(function() {
      test.done()
    }, 200)
  })
}

exports.checkTrackEntityProximityLinksFromEntity1 = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links', find:{_from:testEntity._id, type:'proximity'}}
  }, function(err, res, body) {
    t.assert(body.count === 3)
    test.done()
  })
}

exports.checkTrackEntityProximityLinkFromEntity1ToBeacon2 = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon2._id, _from:testEntity._id, type:'proximity'}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].primary === true)
    t.assert(body.data[0].signal === testBeacon2.level)
    test.done()
  })
}

exports.getEntitiesForLocationWithLocationUpdate = function (test) {
  t.post({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[testBeacon._id]
      , eagerLoad:{children:true,comments:false}
      , beaconLevels:[-80]
      , observation:testObservation2
    }
  }, function(err, res, body) {
    test.done()
  })
}

// Warning:  this is checking the results of a fire-and-forget
//   updated, and may fail due to timing
exports.checkBeaconLocationUpdate = function (test) {
  t.post({
    uri: '/do/find',
    body: {table:'beacons', find:{ _id:testBeacon._id }}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].latitude === 47.1)
    t.assert(body.data[0].longitude === -122.1)
    test.done()
  })
}

exports.cannotDeleteBeaconWhenNotSignedIn = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.userCannotDeleteBeaconSheCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + userCred
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCanDeleteBeaconUserCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + adminCred
  }, function(err, res, body) {
    test.done()
  })
}

exports.userCanCommentOnOwnEntity = function (test) {
  t.post({
    uri: '/do/insertComment?' + userCred,
    body: {entityId:testEntity._id,comment:testComment}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertComment = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0] && body.data[0].comments.length === 1)
    t.assert(body.data && body.data[0] && body.data[0].commentCount === 1)
    test.done()
  })
}

exports.user2CanCommentOnEntityOwnedByUser1 = function (test) {
  testComment.description = "I am user2 and I luv user1"
  t.post({
    uri: '/do/insertComment?' + user2Cred,
    body: {entityId:testEntity._id,comment:testComment}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkComments = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0] && body.data[0].comments.length === 2)
    t.assert(body.data && body.data[0] && body.data[0].commentCount === 2)
    var comments = body.data[0].comments
    // Comments are appended to the end of the comments array
    t.assert(comments[0]._creator === testUser._id)
    t.assert(comments[1]._creator === testUser2._id)
    test.done()
  })
}

exports.updateEntity = function (test) {
  testEntity.name = 'Testing super candi'
  t.post({
    uri: '/do/updateEntity?' + userCred,
    body: {entity:testEntity}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkUpdateEntity = function (test) {
  t.get({
    uri: '/data/entities/' + testEntity._id
  }, function(err, res, body) {
    t.assert(body.data && body.data[0] && body.data[0].name === 'Testing super candi')
    test.done()
  })
}

exports.insertLink = function (test) {
  t.post({
    uri: '/data/links?' + userCred,
    body: {data:testLink}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1 && body.data)
    testLink._id = body.data._id
    test.done()
  })
}

exports.checkInsertedLink = function(test) {
  t.get({
    uri: '/data/links/' + testLink._id
  }, function(err, res, body) {
    t.assert(body.data && body.data[0] && body.data[0]._id === testLink._id)
    test.done()
  })

}

exports.updateLink = function (test) {
  t.post({
    uri: '/do/updateLink?' + userCred,
    body: {link:newTestLink, originalToId: testLink._to}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkUpdatedLink = function (test) {
  t.post({
    uri: '/do/find',
    body: {table:'links', find: {_to: newTestLink._to, _from: newTestLink._from}}
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.deleteEntity = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      deleteChildren:false
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkDeleteEntity = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity._id}}
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteLink = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'links', find:{_to:testBeacon._id, _from:testEntity._id}}
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteEntityLogActions = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'actions', find:{_target:testEntity._id, type:'insert_entity'}}
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteLinkLogActions = function(test) {
  t.post({
    uri: '/do/find',
    body: {table:'actions', find:{_target:primaryLink._id, type:'tune_link_primary'}}
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.userCannotCommentOnLockedRecord = function(test) {
  log('nyi')
  test.done()
}

exports.userCannotLinkToLockedRecord = function(test) {
  log('nyi')
  test.done()
}

exports.adminCanCommentOnLockedRecord = function(test) {
  log('nyi')
  test.done()
}

exports.adminCanLinkToLockedRecord = function(test) {
  log('nyi')
  test.done()
}
