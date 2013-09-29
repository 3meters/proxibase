/**
 *  Proxibase custom methods test
 */

var util = require('proxutils')
var log = util.log
var adminId = util.adminUser._id
var clIds = util.statics.collectionIds
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userId
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
  _id : clIds.users + ".111111.11111.111.111111",
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
  _id : clIds.users + ".111111.11111.111.222222",
  name : "John Q Test2",
  email : "johnqtest2@3meters.com",
  password : "12345678",
  enabled: true,
}
var testPlace = {
  _id : clIds.places + ".111111.11111.111.111111",
  schema : util.statics.schemaPlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550001", 
  provider:{ 
    foursquare:"0001"
  },
  category:{ 
    id:"4bf58dd8d48988d18c941735", 
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  }
}
var testPlace2 = {
  _id : clIds.places + ".111111.11111.111.111112",
  schema : util.statics.schemaPlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"206550002", 
  provider:{ 
    foursquare:"0002"
  },
  category:{ 
    id:"4bf58dd8d48988d18c941735", 
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
}
var testPlace3 = {
  _id : clIds.places + ".111111.11111.111.111113",
  schema : util.statics.schemaPlace,
  name : "Testing place entity",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550003", 
  provider:{ 
    foursquare:"0004"
  },
  category:{ 
    id:"4bf58dd8d48988d18c941735", 
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
}
var testPlaceCustom = {
  _id : clIds.places + ".111111.11111.111.111114",
  schema : util.statics.schemaPlace,
  name : "Testing place entity custom",
  photo: { 
    prefix:"1001_20111224_104245.jpg", 
    source:"aircandi"
  },
  signalFence : -100,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550004", 
  provider:{ 
    aircandi: 'aircandi',
  },
  category:{ 
    id:"4bf58dd8d48988d18c941735", 
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
  locked: true,
}
var testPost = {
  _id : clIds.posts + ".111111.11111.111.111111",
  schema : util.statics.schemaPost,
  name : "Testing post entity",
  photo: { 
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", 
    source:"aircandi",
  },
}
var testCandigramBounce = {
  _id : clIds.candigrams + ".111111.11111.111.111111",
  schema : util.statics.schemaCandigram,
  type : "bounce",
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },  
  name : "Testing candigram entity",
  photo: { 
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", 
    source:"aircandi",
  },
}
var testCandigramTour = {
  _id : clIds.candigrams + ".111111.11111.111.222222",
  schema : util.statics.schemaCandigram,
  type : "tour",
  duration: 60000,
  location: { 
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude] 
  },  
  name : "Testing candigram entity",
  photo: { 
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg", 
    source:"aircandi",
  },
}
var testComment = {
  _id : clIds.comments + ".111111.11111.111.111111",
  schema : util.statics.schemaComment,
  name : "Test comment",
  description : "Test comment, much ado about nothing.",
}
var testComment2 = {
  _id : clIds.comments + ".111111.11111.111.111112",
  schema : util.statics.schemaComment,
  name : "Test comment for locked entity",
  description : "Test comment, much ado about nothing.",
}
var testComment3 = {
  _id : clIds.comments + ".111111.11111.111.111113",
  schema : util.statics.schemaComment,
  name : "Another test comment for locked entity",
  description : "Test comment, much ado about nothing.",
}
var testApplink = {
  schema: util.statics.schemaApplink,
  name: "Applink",
  photo: { 
    prefix:"https://graph.facebook.com/143970268959049/picture?type=large", 
    source:"facebook",
  },
  appId: "143970268959049",
  data: { 
    origin : "facebook", validated : 1369167109174.0, likes : 100
  },
}
var testApplink2 = {
  schema: util.statics.schemaApplink,
  name: "Applink New",
  photo: { 
    prefix:"https://graph.facebook.com/143970268959049/picture?type=large", 
    source:"facebook",
  },
  appId: "143970268959049",
  data: { 
    origin : "facebook", validated : 1369167109174.0, likes : 100
  },
}

var testBeacon = {
  _id : clIds.beacons + '.11:11:11:11:11:11',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '11:11:11:11:11:11',
  signal: -80,  
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testBeacon2 = {
  _id : clIds.beacons + '.22:22:22:22:22:22',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label 2',
  ssid: 'Test Beacon 2',
  bssid: '22:22:22:22:22:22',
  signal: -85,  
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testBeacon3 = {
  _id : clIds.beacons + '.33:33:33:33:33:33',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label 3',
  ssid: 'Test Beacon 3',
  bssid: '33:33:33:33:33:33',
  signal: -95,  
  location: { 
    lat:testLatitude, 
    lng:testLongitude, 
    altitude:12, 
    accuracy:30, 
    geometry:[testLongitude, testLatitude] 
  },
}
var testLink = {
  // _to : clIds.beacons + '.11:11:11:11:11:22',
  _to : testBeacon3._id,
  _from : clIds.places + '.111111.11111.111.111111',
  proximity: {
    primary: true,
    signal: -100
  }
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
    userId = session._owner
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
    uri: '/do/getEntitiesByProximity?' + userCred,
    body: {
      beaconIds: [constants.beaconId],
      registrationId: constants.registrationId
    }
  }, function(err, res, body) {
    t.assert(body.count === 5)
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
    uri: '/do/unregisterDevice?' + userCred,
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
      table:'places', 
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
      table:'beacons', 
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
      table:'places', 
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
      table:'places',
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
      table:'places',
      find:{_id:testPlace3._id}
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
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
    delete ent.phone
    delete ent.provider
    delete ent._id
    ent.name = 'Testing Place Ent with doNotTrack'
    var beacon = util.clone(testBeacon)
    beacon._id = util.statics.collectionIds.beacons + '.44:44:44:44:44:44'
    beacon.bssid = '44:44:44:44:44:44',
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
      var anonId = util.anonUser._id
      t.assert(savedEnt._owner === adminId)
      t.assert(savedEnt._creator === anonId)
      t.assert(savedEnt._modifier === anonId)
      t.get('/data/beacons/' + beacon._id,
        function(err, res, body) {
          t.assert(body.data)
          var savedBeacon = body.data
          t.assert(savedBeacon._owner === adminId)
          t.assert(savedBeacon._creator === anonId)
          t.assert(savedBeacon._modifier === anonId)
          t.get({
            uri: '/data/links?find={"_from":"' + savedEnt._id + '"}'
          }, function(err, res, body) {
            t.assert(body.data[0])
            var link = body.data[0]
            t.assert(link._owner === adminId)
            t.assert(link._creator === anonId)
            t.assert(link._modifier === anonId)
            t.post({ // confirm the anonlog is working
              uri: '/find/anonlog?' + adminCred,
              body: {find: {
                id: beacon._id,
                _user: testUser._id,
              }},
            }, function(err, res, body) {
              t.assert(1 === body.data.length)
              t.assert('insert' === body.data[0].action)
              t.post({   // put things back as we found them
                uri: '/data/users/' + testUser._id + '?' + userCred,
                body: { data: { doNotTrack: false }}
              }, function(err, res) {
                test.done()
              })
            })
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
    t.assert(body.data[0].proximity.signal === testBeacon2.signal)
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
      table:'beacons', 
      find:{ _id:testBeacon._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].location.lat === 47.1)
    t.assert(body.data[0].location.lng === -122.1)
    t.assert(body.data[0].signal === -79)
    test.done()
  })
}

/* Permissions */

exports.cannotDeleteEntityWhenNotSignedIn = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.userCannotDeleteBeaconEntitySheCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + userCred
  }, 401, function(err, res, body) {
    t.get('/data/beacons/' + testBeacon._id, function(err, res, body) {
      t.assert(testBeacon._id === body.data._id)
      test.done()
    })
  })
}

exports.adminCanDeleteBeaconEntityUserCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + adminCred
  }, function(err, res, body) {
    test.done()
  })
}

/* Insert, update, and delete entities */

exports.insertComment = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testComment,
      link: {
        _to: testPlace._id,
        strong: true,
        type: util.statics.typeContent,
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
      table:'comments',
      find: { _id: testComment._id }
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
        type: util.statics.typeContent,
        fromSchema: util.statics.schemaComment,
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
    uri: '/data/places/' + testPlace._id
  }, function(err, res, body) {
    t.assert(body.data && body.data && body.data.name === 'Testing super candi')
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
    t.assert(body.data && body.data && body.data._id === testLink._id)
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
      table:'places',
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
      table:'comments',
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

exports.nonOwnerCannotCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + user2Cred,
    body: {
      entity: testComment2, 
      link: {
        _to: testPlaceCustom._id,
        type: util.statics.typeContent,
        strong: true,
      },
      skipNotifications: true
    }
  }, 401, function(err, res, body) {
    t.assert(body.error && body.error.code === 401.6)
    test.done()
  })
}

exports.ownerCanCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testComment2, 
      link: {
        _to: testPlaceCustom._id,
        type: util.statics.typeContent,
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

exports.checkOwnerInsertedCommentOnLockedRecord = function (test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'comments', 
      find:{ _id:testComment2._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.adminCanCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + adminCred,
    body: {
      entity: testComment3, 
      link: {
        _to: testPlaceCustom._id,
        type: util.statics.typeContent,
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

exports.checkAdminInsertedCommentOnLockedRecord = function (test) {
  t.post({
    uri: '/do/find',
    body: {
      table:'comments', 
      find:{ _id:testComment3._id }
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.nonOwnerCannotUpdateLockedRecord = function(test) {
  testPlaceCustom.name = 'Testing non owner update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + user2Cred,
    body: {
      entity:testPlaceCustom
    }
  }, 401, function(err, res, body) {
    t.assert(body.error && body.error.code === 401.6)
    test.done()
  })
}

exports.ownerCanUpdateLockedRecord = function(test) {
  testPlaceCustom.name = 'Testing owner update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + userCred,
    body: {
      entity:testPlaceCustom
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkOwnerUpdatedLockedRecord = function (test) {
  t.get({
    uri: '/data/places/' + testPlaceCustom._id
  }, function(err, res, body) {
    t.assert(body.data && body.data && body.data.name === 'Testing owner update of locked entity')
    test.done()
  })
}

exports.adminCanUpdateLockedRecord = function(test) {
  testPlaceCustom.name = 'Testing admin update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + adminCred,
    body: {
      entity:testPlaceCustom
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.checkAdminUpdatedLockedRecord = function (test) {
  t.get({
    uri: '/data/places/' + testPlaceCustom._id
  }, function(err, res, body) {
    t.assert(body.data && body.data && body.data.name === 'Testing admin update of locked entity')
    test.done()
  })
}

/*
exports.adminCanDeleteBeaconEntityUserCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + adminCred
  }, function(err, res, body) {
    test.done()
  })
}
*/
