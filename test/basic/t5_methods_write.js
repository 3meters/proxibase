/**
 *  Proxibase custom methods test
 */

var util = require('proxutils')
var log = util.log
var adminId = util.adminUser._id
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCred
var user2Cred
var adminCred
var primaryLink
var trackingLink
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var testLatitude2 = 47.1
var testLongitude2 = -122.1
var radiusTiny = 0.000001
var radiusBig = 10000
var testUser = {
  _id : "0001.111111.11111.111.111111",
  name : "John Q Test",
  email : "johnqtest@3meters.com",
  password : "12345678",
  photo: { 
    prefix:"resource:placeholder_user", 
    source:"resource",
  },
  area : "Testville, WA",
  developer : false,
  enabled: true,
}
var testUser2 = {
  _id : "0001.111111.11111.111.222222",
  name : "John Q Test2",
  email : "johnqtest2@3meters.com",
  password : "12345678",
  enabled: true,
}
var testPlace = {
  _id : "0004.111111.11111.111.111111",
  type : util.statics.typePlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  place: { 
    address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065551212", 
    provider:{ 
      foursquare:"4bf58dd8d48988d18c941735"
    },
    category:{ 
      id:"4bf58dd8d48988d18c941735", 
      name : "Baseball Stadium",
      photo:{
        prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
        source : "assets.categories",
      },
    }
  },
}
var testPlace2 = {
  _id : "0004.111111.11111.111.111112",
  type : util.statics.typePlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  place: { 
    address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065551212", 
    provider:{ 
      foursquare:"4bf58dd8d48988d18c941735"
    },
    category:{ 
      id:"4bf58dd8d48988d18c941735", 
      name : "Baseball Stadium",
      photo:{
        prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
        source : "assets.categories",
      },
    }
  },
}
var testPlace3 = {
  _id : "0004.111111.11111.111.111113",
  type : util.statics.typePlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  place: { 
    address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065551212", 
    provider:{ 
      foursquare:"4bf58dd8d48988d18c941735"
    },
    category:{ 
      id:"4bf58dd8d48988d18c941735", 
      name : "Baseball Stadium",
      photo:{
        prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
        source : "assets.categories",
      },
    }
  },
}
var testPlaceCustom = {
  _id : "0004.111111.11111.111.111114",
  type : util.statics.typePlace,
  name : "Testing place entity custom",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  place: { 
    address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065551212", 
    provider:{ 
      user: testUser._id
    },
    category:{ 
      id:"4bf58dd8d48988d18c941735", 
      name : "Baseball Stadium",
      photo:{
        prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
        source : "assets.categories",
      },
    }
  },
}
var testPost = {
  _id : "0004.111111.11111.111.211111",
  type : util.statics.typePost,
  name : "Testing post entity",
  photo: { 
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", 
    source:"aircandi",
  },
}
var testComment = {
  _id : "0004.111111.11111.111.311111",
  type : util.statics.typeComment,
  name : "Test comment",
  description : "Test comment, much ado about nothing.",
}
var testApplink = {
  _id: "0004.111111.11111.111.411111",
  type: util.statics.typeApplink,
  name: "Bannerwood Park",
  photo: { 
    prefix:"https://graph.facebook.com/143970268959049/picture?type=large", 
    source:"facebook",
  },
  appId: "143970268959049",
  sdata: { 
    origin : "facebook", validated : 1369167109174.0, likes : 9 
  },
}
var testLink = {
  _to : '0008.11:11:11:11:11:22',
  _from : '0004.111111.11111.111.111111',
  proximity: {
    primary: true,
    signal: -100
  }
}
var newTestLink = {
  _to : '0004.111111.11111.111.111112',
  _from : '0004.111111.11111.111.111111',
}
var testBeacon = {
  _id : '0004.11:11:11:11:11:11',
  type : util.statics.typeBeacon,
  name: 'Test Beacon Label',
  beacon: {
    ssid: 'Test Beacon',
    bssid: '11:11:11:11:11:11',
    signal: -80,  
  },
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testBeacon2 = {
  _id : '0004.22:22:22:22:22:22',
  type : util.statics.typeBeacon,
  name: 'Test Beacon Label 2',
  beacon: {
    ssid: 'Test Beacon 2',
    bssid: '22:22:22:22:22:22',
    signal: -85,  
  },
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testBeacon3 = {
  _id : '0004.33:33:33:33:33:33',
  type : util.statics.typeBeacon,
  name: 'Test Beacon Label 3',
  beacon: {
    ssid: 'Test Beacon 3',
    bssid: '33:33:33:33:33:33',
    signal: -95,  
  },
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testLocation = {
  lat : testLatitude,
  lng : testLongitude,
  altitude : 100,
  accuracy : 50.0
}
var testLocation2 = {
  lat : testLatitude2,
  lng : testLongitude2,
  altitude : 12,
  accuracy : 30.0
}
var testLocation3 = {
  lat : 46.15,
  lng : -121.1,
  altitude : 12,
  accuracy : 30.0
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

exports.registerDeviceForNotifications = function (test) {
  t.post({
    uri: '/data/devices?' + userCred,
    body: {
      data: { 
        _id: constants.deviceId,
        _user: testUser._id,
        registrationId: constants.registrationId,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      },
    }
  }, 201, function(err, res, body) {
    test.done()
  })
}

exports.checkRegisterDevice = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'devices', 
      find:{ _id:constants.deviceId }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].registrationId)
    test.done()
  })
}

exports.updateRegisteredDeviceBeacons = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      entityType: 'entities',
      registrationId: 'a1a1a1a1a1'
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    test.done()
  })
}

exports.checkDeviceBeacons = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'devices', 
      find:{ _id:constants.deviceId }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].beacons.length === 1)
    t.assert(body.data[0].beaconsDate)
    test.done()
  })
}

exports.unregisterDeviceForNotifications = function (test) {
  t.post({
    uri: '/do/unregisterDevice',
    body: {
      registrationId: constants.registrationId,
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('deleted') > 0)
    test.done()
  })
}

exports.checkUnregisterDevice = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'devices', 
      find:{ _id:constants.deviceId }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.cannotInsertEntityNotLoggedIn = function (test) {
  t.post({
    uri: '/do/insertEntity',
    body: {
      entity:testPlace, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      skipNotifications:true
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.insertPlace = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testPlace, 
      beacons: [testBeacon], 
      primaryBeaconId: testBeacon._id,
      skipNotifications: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var savedEnt = body.data[0]
    t.assert(savedEnt._owner === util.adminUser._id)
    t.assert(savedEnt._creator === testUser._id)
    t.assert(savedEnt._modifier === testUser._id)

    /* Find and store the primary link that was created by insertEntity */
    t.post({
      uri: '/do/find',
      body: {
        table:'links',
        find:{ _to:testBeacon._id, _from:body.data._id, 'proximity.primary':true }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      primaryLink = body.data[0]
      test.done()
    })
  })
}

exports.checkInsertPlace = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities', 
      find:{ _id:testPlace._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertBeacon = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities', 
      find:{ _id:testBeacon._id }
    }
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

exports.checkInsertLinkToBeacon = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links',
      find:{ _to:testBeacon._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertPlaceLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions',
      find:{ _target:testPlace._id, type:'insert_entity_place_linked'}
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.insertPlaceCustom = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testPlaceCustom, 
      beacons: [testBeacon], 
      primaryBeaconId: testBeacon._id,
      skipNotifications: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var savedEnt = body.data[0]
    t.assert(savedEnt._owner === testUser._id)
    t.assert(savedEnt._creator === testUser._id)
    t.assert(savedEnt._modifier === testUser._id)
    test.done()
  })
}

exports.checkInsertPlaceCustom = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities', 
      find:{ _id:testPlaceCustom._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.insertPlaceBeaconAlreadyExists = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testPlace2, 
      beacons:[testBeacon], 
      primaryBeaconId:testBeacon._id,
      skipNotifications:true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0]._id)
    test.done()
  })
}

exports.checkInsertPlaceBeaconAlreadyExists = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities',
      find:{ _id:testPlace2._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkBeaconLinkCount = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links',
      find:{ _to:testBeacon._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    test.done()
  })
}

exports.insertPlaceEntityWithNoLinks = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testPlace3,
      skipNotifications:true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertEntityNoLinks = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities',
      find:{_id:testPlace3._id}
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0] && body.data[0].place)
    var ent = body.data[0]
    t.assert(ent.location.lat && ent.location.lng)
    t.assert(ent.location.geometry)
    t.assert(ent._owner === adminId) // admins own places
    t.assert(ent._creator === testUser._id)
    t.assert(ent._modifier === testUser._id)
    t.assert(ent.createdDate === ent.modifiedDate)
    test.done()
  })
}

exports.insertEntityDoNotTrack = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + userCred,
    body: { 
      data: { doNotTrack: true }
    }
  }, function(err, res) {
    t.assert(res.body.data.doNotTrack)
    var ent = util.clone(testPlace3) // place entity
    delete ent._id
    ent.name = 'Testing Place Ent with doNotTrack'
    var beacon = util.clone(testBeacon)
    beacon._id = '0004.44:44:44:44:44:44'
    beacon.beacon.bssid = '44:44:44:44:44:44',
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: ent,
        beacons: [beacon],
        primaryBeaconId: beacon._id,
        skipNotifications: true
      }
    }, 201, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      var savedEnt = body.data[0]
      var adminId = util.adminUser._id
      t.assert(savedEnt._owner === adminId)
      t.assert(savedEnt._creator === adminId)
      t.assert(savedEnt._modifier === adminId)
      t.get('/data/entities/' + beacon._id,
        function(err, res, body) {
          t.assert(body.data[0])
          var savedBeacon = body.data[0]
          t.assert(savedBeacon._owner === adminId)
          t.assert(savedBeacon._creator === adminId)
          t.assert(savedBeacon._modifier === adminId)
          t.get({
            uri: '/data/links?find={"_from":"' + savedEnt._id + '"}'
          }, function(err, res, body) {
            t.assert(body.data[0])
            var link = body.data[0]
            t.assert(link._owner === adminId)
            t.assert(link._creator === adminId)
            t.assert(link._modifier === adminId)
            test.done()
          })
        })
      })
    })
}

exports.likeEntity = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCred,
    body: {
      toId: testPlace2._id, 
      fromId: testUser._id,
      type: util.statics.typeLike,
      actionType: 'like'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkLikeEntityLinkToEntity2 = function(test) {
  t.post({
    uri: '/do/find',
    body: { 
      table:'links', 
      find:{ _to:testPlace2._id, type: util.statics.typeLike }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkLikeEntityLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions',
      find:{ _target:testPlace2._id, type:'like'}
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.unlikeEntity = function(test) {
  t.post({
    uri: '/do/deleteLink?' + userCred,
    body: {
      toId: testPlace2._id, 
      fromId: testUser._id,
      type: util.statics.typeLike,
      actionType: 'unlike'
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('successful') > 0)
    test.done()
  })
}

exports.checkUnlikeEntity = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links', 
      find:{ 
        _to:testPlace2._id, 
        _from:testUser._id, 
        type:util.statics.typeLike
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

/* Track and untrack */

exports.trackEntityProximity = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testPlace._id, 
      beacons:[testBeacon, testBeacon2, testBeacon3], 
      primaryBeaconId:testBeacon2._id,
      actionType:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)
    test.done()
  })
}

exports.checkTrackEntityProximityLinksFromEntity1 = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links', 
      find:{
        _from:testPlace._id, 
        type:util.statics.typeProximity
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    test.done()
  })
}

exports.checkTrackEntityProximityLinkFromEntity1ToBeacon2 = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links',
      find:{
        _to:testBeacon2._id, 
        _from:testPlace._id, 
        type:util.statics.typeProximity
      }
    }
  }, function(err, res, body) {
    trackingLink = body.data[0]
    t.assert(body.count === 1)
    t.assert(body.data[0].proximity.primary === true)
    t.assert(body.data[0].proximity.signal === testBeacon2.beacon.signal)
    test.done()
  })
}

exports.checkTrackEntityLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions',
      find:{ 
        _target:trackingLink._id, 
        type:'link_proximity'
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.untrackEntityProximity = function(test) {
  t.post({
    uri: '/do/untrackEntity?' + userCred,
    body: {
      entityId:testPlace._id, 
      beaconIds:[testBeacon._id, testBeacon2._id, testBeacon3._id], 
      primaryBeaconId:testBeacon2._id,
      actionType:'proximity_minus',
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('untracked') > 0)
    test.done()
  })
}

exports.checkUntrackEntityProximityLinksFromEntity1 = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links', 
      find:{
        _from:testPlace._id, 
        type:util.statics.typeProximity
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.trackEntityNoBeacons = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testPlace._id, 
      actionType:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)
    test.done()
  })
}

exports.checkTrackEntityNoBeaconsLogAction = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions',
      find:{ 
        _target:testPlace._id, 
        type:'entity_proximity'
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

/* Location update */

exports.updateBeaconLocationUsingNewLocation = function (test) {
  t.post({
    uri: '/do/updateBeaconLocation',
    body: {
      beaconIds: [testBeacon._id], 
      beaconSignals: [-79], 
      location: testLocation2
    }
  }, function(err, res, body) {
    setTimeout(function() {
      // beacon observation update is fire-and-forget, give time to finish
      test.done()
    }, 200)
  })
}

exports.checkBeaconLocationUpdate = function (test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities', 
      find:{ _id:testBeacon._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].location.lat === 47.1)
    t.assert(body.data[0].location.lng === -122.1)
    t.assert(body.data[0].beacon.signal === -79)
    test.done()
  })
}

exports.cannotDeleteEntityWhenNotSignedIn = function (test) {
  t.del({
    uri: '/data/entities/' + testBeacon._id
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.userCannotDeleteBeaconEntitySheCreated = function (test) {
  t.del({
    uri: '/data/entities/' + testBeacon._id + '?' + userCred
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCanDeleteBeaconEntityUserCreated = function (test) {
  t.del({
    uri: '/data/entities/' + testBeacon._id + '?' + adminCred
  }, function(err, res, body) {
    test.done()
  })
}

exports.insertComment = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testComment, 
      link: {
        _to: testPlace._id,
        type: util.statics.typeComment,
        strong: true,
      },
      skipNotifications: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    test.done()
  })
}

exports.checkInsertComment = function (test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities', 
      find:{ _id:testComment._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.checkInsertCommentLink = function (test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links', 
      find:{ 
        _from:testComment._id,
        _to:testPlace._id,
        type:util.statics.typeComment,
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].strong === true)
    test.done()
  })
}

exports.updateEntity = function (test) {
  testPlace.name = 'Testing super candi'
  t.post({
    uri: '/do/updateEntity?' + userCred,
    body: {
      entity:testPlace
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkUpdateEntity = function (test) {
  t.get({
    uri: '/data/entities/' + testPlace._id
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

exports.userCantDeleteEntityTheyDontOwn = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + userCred,
    body: {
      entityId:testPlace._id, 
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.deleteEntity = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + adminCred,
    body: {
      entityId:testPlace._id, 
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
    body: {
      table:'entities',
      find:{
        _id:testPlace._id
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteLink = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'links', 
      find:{
        _to:testBeacon._id, 
        _from:testPlace._id
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteStrongLinkedEntity = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'entities',
      find:{
        _id:testComment._id
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteEntityLogActions = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions', 
      find:{
        _target:testPlace._id, 
        type:'insert_entity'
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 0)
    test.done()
  })
}

exports.checkDeleteLinkLogActions = function(test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'actions', 
      find:{
        _target:primaryLink._id, 
        type:'tune_link_primary'
      }
    }
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