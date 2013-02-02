
/*
 *  Proxibase custom methods test
 */

var
  assert = require('assert'),
  request = require('request'),
  util = require('utils'),
  log = util.log,
  testUtil = require('../util'),
  t = testUtil.T(),  // newfangled test helper
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  constants = require('../constants'),
  dbProfile = constants.dbProfile.smokeTest,
  userCred,
  user2Cred,
  adminCred,
  primaryLink,
  _exports = {}, // for commenting out tests
  testLatitude = 46.1,
  testLongitude = -121.1,
  testLatitude2 = 47.1,
  testLongitude2 = -122.1,   
  radiusTiny = (0.000001 / 3959),
  radiusBig = (10 / 3959),
  testUser = {
    _id : "0001.111111.11111.111.111111",
    name : "John Q Test",
    email : "johnqtest@3meters.com",
    password : "12345678",
    photo: {prefix:"resource:placeholder_user", format:"binary", sourceName:"aircandi"},
    location : "Testville, WA",
    isDeveloper : false
  },
  testUser2 = {
    _id : "0001.111111.11111.111.222222",
    name : "John Q Test2",
    email : "johnqtest2@3meters.com",
    password : "12345678"
  },
  testEntity = {
    _id : "0004.111111.11111.111.111111",
    photo: {prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", format:"binary", sourceName:"aircandi"},
    signalFence : -100,
    name : "Testing candi",
    type : "com.aircandi.candi.picture",
    visibility : "public",
    isCollection: false,
    enabled : true,
    locked : false
  },
  testEntity2 = {
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
  },
  testEntity3 = {
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
  },
  testLink = {
    _to : '0008.11:11:11:11:11:22',
    _from : '0004.111111.11111.111.111111',
    primary: true,
    signal: -100
  },
  newTestLink = {
    _to : '0004.111111.11111.111.111112',
    _from : '0004.111111.11111.111.111111',
    primary: true,
    signal: -100
  }
  testBeacon = {
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
  },
  testBeacon2 = {
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
  },
  testBeacon3 = {
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
  },
  testObservation = {
      latitude : testLatitude,
      longitude : testLongitude,
      altitude : 100,
      accuracy : 50.0
  },
  testObservation2 = {
      latitude : testLatitude2,
      longitude : testLongitude2,
      altitude : 12,
      accuracy : 30.0
  },
  testObservation3 = {
      latitude : 46.15,
      longitude : -121.1,
      altitude : 12,
      accuracy : 30.0
  },
  testComment = {
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
  var req = new Req({
    uri: '/do/getEntities',
    body: {entityIds: [constants.entityId], 
        eagerLoad: {parents: false, children: true, comments: true}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0], dump(req, res))
    var record = res.body.data[0]
    assert(record.children.length === dbProfile.spe, dump(req, res))
    assert(record.childCount === dbProfile.spe, dump(req, res))
    assert(record.comments.length === dbProfile.cpe, dump(req, res))
    assert(record.commentCount === dbProfile.cpe, dump(req, res))
    assert(record.links[0]._to === constants.beaconId, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForLocation = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[constants.beaconId],eagerLoad:{children:true,comments:false}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === dbProfile.epb, dump(req, res))
    assert(res.body.date, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForLocationLimited = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[constants.beaconId], 
        eagerLoad:{ children:true,comments:false }, 
        options:{limit:3, skip:0, sort:{modifiedDate:-1}}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 3, dump(req, res))
    assert(res.body.more === true, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForUser',
    body: {userId:constants.uid1, eagerLoad:{children:false,comments:false}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === Math.min(constants.recordLimit,
        dbProfile.beacons * dbProfile.epb / dbProfile.users), dump(req, res))
    test.done()
  })
}


exports.cannotInsertEntityNotLoggedIn = function (test) {
  var req = new Req({
    uri: '/do/insertEntity',
    body: {
      entity:testEntity, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}

exports.insertEntity = function (test) {
  var req = new Req({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0]._id, dump(req, res))

    /* Find and store the primary link that was created by insertEntity */
    req = new Req({
      uri: '/do/find',
      body: {table:'links',find:{_to:testBeacon._id, _from:res.body.data._id, primary:true}}
    })
    request(req, function(err, res) {
      check(req, res)
      assert(res.body.count === 1, dump(req, res))
      primaryLink = res.body.data[0]
      test.done()
    })
  })
}

exports.checkInsertEntity = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertEntityLogAction = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'actions',find:{_target:testEntity._id, type:'insert_entity_picture'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertLinkLogAction = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'actions',find:{_target:primaryLink._id, type:'link_browse'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.insertEntityBeaconAlreadyExists = function (test) {
  var req = new Req({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity2, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      observation:testObservation
    }
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0]._id, dump(req, res))
    test.done()
  })
}

exports.checkInsertEntityBeaconAlreadyExists = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity2._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertLinkToEntity = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 2, dump(req, res))
    test.done()
  })
}

exports.checkInsertBeacon = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'beacons', find:{ _id:testBeacon._id }}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    // Beacons should be owned by admin
    assert(res.body.data[0]._owner === util.adminUser._id)
    // Creator and modifier should be user who first added them
    assert(res.body.data[0]._creator === testUser._id)
    assert(res.body.data[0]._modifier === testUser._id)
    test.done()
  })
}

exports.insertEntityWithNoLinks = function (test) {
  var req = new Req({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testEntity3,
      observation:testObservation
    }
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertEntityNoLinks = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity3._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data[0] && res.body.data[0].place, dump(req, res))
    assert(res.body.data[0].place.location, dump(req, res))
    assert(res.body.data[0].place.location.lat && res.body.data[0].place.location.lng, dump(req, res))
    assert(res.body.data[0].loc, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForLocationIncludingNoLinkBigRadius = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForLocation',
    body: {
      beaconIdsNew:[testBeacon._id], 
      eagerLoad:{children:true,comments:false}, 
      observation:testObservation3, 
      radius: radiusBig 
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    assert(res.body.count === 3, dump(req, res))
    assert(res.body.date, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForLocationIncludingNoLinkTinyRadius = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForLocation',
    body: {
      beaconIdsNew:[testBeacon._id], 
      eagerLoad:{children:true,comments:false}, 
      observation:testObservation3, 
      radius: radiusTiny
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    assert(res.body.count === 2, dump(req, res))
    assert(res.body.date, dump(req, res))
    test.done()
  })
}

exports.trackEntityBrowse = function(test) {
  var req = new Req({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      beacons:[testBeacon, testBeacon2, testBeacon3], 
      primaryBeaconId:testBeacon2._id,
      observation:testObservation,
      actionType:'browse'
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    test.done()
  })
}

exports.checkTrackEntityBrowseAddedBeacon2 = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'beacons', find:{_id:testBeacon2._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkTrackEntityBrowseLinksFromEntity1 = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links', find:{_from:testEntity._id, type:'browse'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 3, dump(req, res))
    test.done()
  })
}

exports.checkTrackEntityBrowseLinkFromEntity1ToBeacon2 = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon2._id, _from:testEntity._id, type:'browse'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data[0].primary === true, dump(req, res))
    assert(res.body.data[0].signal === testBeacon2.level, dump(req, res))
    test.done()
  })
}

exports.trackEntityProximity = function(test) {
  var req = new Req({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      beacons:[testBeacon, testBeacon2, testBeacon3], 
      primaryBeaconId:testBeacon2._id,
      observation:testObservation,
      actionType:'proximity'
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    // give the fire-and-forget query some time to finish writing
    setTimeout(function() {
      test.done()
    }, 200)
  })
}

exports.checkTrackEntityProximityLinksFromEntity1 = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links', find:{_from:testEntity._id, type:'proximity'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 3, dump(req, res))
    test.done()
  })
}

exports.checkTrackEntityProximityLinkFromEntity1ToBeacon2 = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon2._id, _from:testEntity._id, type:'proximity'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data[0].primary === true, dump(req, res))
    assert(res.body.data[0].signal === testBeacon2.level, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForLocationWithLocationUpdate = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForLocation',
    body: {beaconIdsNew:[testBeacon._id]
      , eagerLoad:{children:true,comments:false}
      , beaconLevels:[-80]
      , observation:testObservation2
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    test.done()
  })
}

// Warning:  this is checking the results of a fire-and-forget
//   updated, and may fail due to timing
exports.checkBeaconLocationUpdate = function (test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'beacons', find:{ _id:testBeacon._id }}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data[0].latitude === 47.1)
    assert(res.body.data[0].longitude === -122.1)
    test.done()
  })
}

exports.cannotDeleteBeaconWhenNotSignedIn = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/' + testBeacon._id
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}

exports.userCannotDeleteBeaconSheCreated = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/' + testBeacon._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}

exports.adminCanDeleteBeaconUserCreated = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/' + testBeacon._id + '?' + adminCred
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.userCanCommentOnOwnEntity = function (test) {
  var req = new Req({
    uri: '/do/insertComment?' + userCred,
    body: {entityId:testEntity._id,comment:testComment}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertComment = function (test) {
  var req = new Req({
    uri: '/do/getEntities',
    body: {entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].comments.length === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].commentCount === 1, dump(req, res))
    test.done()
  })
}

exports.user2CanCommentOnEntityOwnedByUser1 = function (test) {
  testComment.description = "I am user2 and I luv user1"
  var req = new Req({
    uri: '/do/insertComment?' + user2Cred,
    body: {entityId:testEntity._id,comment:testComment}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkComments = function (test) {
  var req = new Req({
    uri: '/do/getEntities',
    body: {entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].comments.length === 2, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].commentCount === 2, dump(req, res))
    var comments = res.body.data[0].comments
    // Comments are appended to the end of the comments array
    assert(comments[0]._creator === testUser._id)
    assert(comments[1]._creator === testUser2._id)
    test.done()
  })
}

exports.updateEntity = function (test) {
  testEntity.name = 'Testing super candi'
  var req = new Req({
    uri: '/do/updateEntity?' + userCred,
    body: {entity:testEntity}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkUpdateEntity = function (test) {
  var req = new Req({
    method: 'get',
    uri: '/data/entities/' + testEntity._id
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].name === 'Testing super candi', dump(req, res))
    test.done()
  })
}

exports.insertLink = function (test) {
  var req = new Req({
    uri: '/data/links?' + userCred,
    body: {data:testLink}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1 && res.body.data, dump(req, res))
    testLink._id = res.body.data._id
    test.done()
  })
}

exports.checkInsertedLink = function(test) {
  var req = new Req({
    method: 'get',
    uri: '/data/links/' + testLink._id
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0]._id === testLink._id, dump(req, res))
    test.done()
  })

}

exports.updateLink = function (test) {
  var req = new Req({
    uri: '/do/updateLink?' + userCred,
    body: {link:newTestLink, originalToId: testLink._to}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkUpdatedLink = function (test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links', find: {_to: newTestLink._to, _from: newTestLink._from}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.deleteEntity = function (test) {
  var req = new Req({
    uri: '/do/deleteEntity?' + userCred,
    body: {
      entityId:testEntity._id, 
      deleteChildren:false
    }
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkDeleteEntity = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'entities',find:{_id:testEntity._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteLink = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links', find:{_to:testBeacon._id, _from:testEntity._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteEntityLogActions = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'actions', find:{_target:testEntity._id, type:'insert_entity'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteLinkLogActions = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'actions', find:{_target:primaryLink._id, type:'tune_link_primary'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
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
