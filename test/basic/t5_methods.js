
/*
 *  Proxibase custom methods test
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
  constants = require('../constants'),
  dbProfile = constants.dbProfile.smokeTest,
  userCred,
  user2Cred,
  adminCred,
  _exports = {}, // for commenting out tests
  testLatitude = 46.1,
  testLongitude = 121.1,
  testUser = {
    _id : "0000.111111.11111.111.111111",
    name : "John Q Test",
    email : "johnqtest@3meters.com",
    password : "12345678",
    imageUri : "resource:placeholder_user",
    location : "Testville, WA",
    isDeveloper : false
  },
  testUser2 = {
    _id : "0000.111111.11111.111.222222",
    name : "John Q Test2",
    email : "johnqtest2@3meters.com",
    password : "12345678"
  },
  testEntity = {
    _id : "0002.111111.11111.111.111111",
    imagePreviewUri : "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    imageUri : "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    label : "Testing candi",
    signalFence : -100,
    title : "Testing candi",
    type : "com.aircandi.candi.picture",
    visibility : "public",
    enabled : true,
    locked : false,
    linkJavascriptEnabled : false,
    linkZoom : false,
    root : true
  },
  testLink = {
    _to : '0003:11:11:11:11:11:22',
    _from : '0002.111111.11111.111.111111'
  },
  newTestLink = {
    _to : '0002.111111.11111.111.111112',
    _from : '0002.111111.11111.111.111111'
  }
  testBeacon = {
    _id : '0003:11:11:11:11:11:11',
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
  testComment = {
      title : "Test Comment",
      description : "Test comment, much ado about nothing.",
      name : "John Q Test",
      location : "Testville, WA",
      imageUri : "resource:placeholder_user",
      _creator : testUser._id
  }


// get version info and also make sure the server is responding
// george:  I think this should be a server API rather than a db lookup
exports.lookupVersion = function (test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'documents',find:{type:'version',target:'aircandi'}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
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
    assert(!record.parents, dump(req, res))
    assert(record.parentCount === 0, dump(req, res))
    assert(record.comments.length === dbProfile.cpe, dump(req, res))
    assert(record.commentCount === dbProfile.cpe, dump(req, res))
    assert(record._beacon === constants.beaconId, dump(req, res))
    assert(record.location, dump(req, res))
    assert(record.location.latitude, dump(req, res))
    assert(record.location.longitude, dump(req, res))
    test.done()
  })
}

exports.getEntitiesLoadParents = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have both
   * a parent and children. We also don't have any entities with multiple parents.
   */
  var req = new Req({
    uri: '/do/getEntities',
    body: { entityIds:[constants.childEntityId], eagerLoad:{parents:true,children:false,comments:true} }
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0], dump(req, res))
    var record = res.body.data[0]
    assert(!record.children, dump(req, res))
    assert(record.childCount === 0, dump(req, res))
    assert(record.parents.length === 1, dump(req, res))
    assert(record.parentCount === 1, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeacons = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForBeacons',
    body: {beaconIdsNew:[constants.beaconId],eagerLoad:{children:true,comments:false}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === dbProfile.epb, dump(req, res))
    assert(res.body.date, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeaconsLimited = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForBeacons',
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

exports.getEntitiesNearLocation = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesNearLocation',
    body: {userId:testUser._id,latitude:testLatitude,longitude:testLongitude,radius:0.00001}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.insertRootEntity = function (test) {
  var req = new Req({
    uri: '/do/insertEntity?' + userCred,
    body: {entity:testEntity, beacon:testBeacon, 
        link:{_to:testBeacon._id}, observation:{latitude:testLatitude, 
        longitude:testLongitude, _beacon:testBeacon._id},userId:testUser._id}
  })
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkInsertRootEntity = function(test) {
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

exports.checkInsertLinkToRootEntity = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'links',find:{_to:testBeacon._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
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

exports.getEntitiesForBeaconsLocationUpdate = function (test) {
  var req = new Req({
    uri: '/do/getEntitiesForBeacons',
    body: {beaconIdsNew:[testBeacon._id]
      , eagerLoad:{children:true,comments:false}
      , beaconLevels:[-80]
      , observation: {accuracy:30.0, latitude:47.1, longitude: -122.1, altitude: 12}
    }
  })
  request(req, function(err, res) {
    check(req, res, 200)
    test.done()
  })
}

exports.checkLocationUpdate = function (test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'beacons', find:{ _id:testBeacon._id }}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data[0].latitude === 47.1)
    assert(res.body.data[0].latitude === 122.1)
    test.done()
  })
}

exports.cannotDeleteBeaconWhenNotSignedIn = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/ids:' + testBeacon._id
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}

exports.userCannotDeleteBeaconSheCreated = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/ids:' + testBeacon._id + '?' + userCred
  })
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}

exports.adminCanDeleteBeaconUserCreated = function (test) {
  var req = new Req({
    method: 'delete',
    uri: '/data/beacons/ids:' + testBeacon._id + '?' + adminCred
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.checkInsertObservationForRootEntity = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    // Observations should be owned by admin
    assert(res.body.data[0]._owner === util.adminUser._id)
    // Creator and modifier should be user who first added them
    assert(res.body.data[0]._creator === testUser._id)
    assert(res.body.data[0]._modifier === testUser._id)
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
    // Comments are inserted at the beginning of the comments array
    assert(comments[0]._creator === testUser2._id)
    assert(comments[1]._creator === testUser._id)
    test.done()
  })
}

exports.updateEntity = function (test) {
  testEntity.title = 'Testing super candi'
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
    uri: '/data/entities/ids:' + testEntity._id
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].title === 'Testing super candi', dump(req, res))
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
    uri: '/data/links/ids:' + testLink._id
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
    body: {entityId:testEntity._id,deleteChildren:false}
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
    body: {table:'links',find:{_to:testBeacon._id,_from:testEntity._id}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteObservation = function(test) {
  var req = new Req({
    uri: '/do/find',
    body: {table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}}
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

