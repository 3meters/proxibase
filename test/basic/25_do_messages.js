/**
 *  Proxibase custom methods test
 */

var util = require('proxutils')
var adminId = util.adminUser._id
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCredTom
var userCredBob
var userCredAlice
var userCredBecky
var userCredMax
var userCredStan
var adminCred
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var installId1 = '5905d547-8321-4613-abe1-00001'
var installId2 = '5905d547-8321-4613-abe1-00002'
var installId3 = '5905d547-8321-4613-abe1-00003'
var installId4 = '5905d547-8321-4613-abe1-00004'
var installId5 = '5905d547-8321-4613-abe1-00005'
var installId6 = '5905d547-8321-4613-abe1-00006'
var expirationDate
var activityDate
var beckyWatchLinkId
var aliceWatchLinkId
var activityDateBobsPatch


// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var patch1Id = 'pa.010101.00000.555.000001'
var messagesPerPatch = dbProfile.mpp


var testUserTom = {
  _id :  "us.111111.11111.001.111111",
  name : "Tom",
  email : "tomtest25@3meters.com",
  password : "12345678",
  photo: {
    prefix:"resource:patchholder_user",
    source:"resource",
  },
  area : "Testville, WA",
}

var testUserBob = {
  _id : "us.111111.11111.001.222222",
  name : "Bob",
  email : "bobtest25@3meters.com",
  password : "12345678",
}

var testUserAlice = {
  _id : "us.111111.11111.001.333333",
  name : "Alice",
  email : "alicetest25@3meters.com",
  password : "12345678",
}

var testUserBecky = {
  _id : "us.111111.11111.001.444444",
  name : "Becky",
  email : "beckytest25@3meters.com",
  password : "12345678",
}

var testUserMax = {
  _id : "us.111111.11111.001.555555",
  name : "Max",
  email : "maxtest25@3meters.com",
  password : "12345678",
}

var testUserStan = {
  _id : "us.111111.11111.001.666666",
  name : "Stan",
  email : "stantest25@3meters.com",
  password : "12345678",
}

var testPatchPublic = {
  _id : "pa.111111.11111.112.311114",
  schema : util.statics.schemaPatch,
  name : "Hawks Nest",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: 'place',
  visibility: "public"
}

var locationUserMaxNearby = {
  lat: testLatitude,
  lng: testLongitude,
  altitude: 12,
  accuracy: 30,
  geometry: [testLongitude, testLatitude]
}

var locationUserMaxNotNearby = {
  lat: testLatitude + .1,
  lng: testLongitude + .1,
  altitude: 12,
  accuracy: 30,
  geometry: [testLongitude, testLatitude]
}

var locationUserMaxPoorAccuracy = {
  lat: testLatitude,
  lng: testLongitude,
  altitude: 12,
  accuracy: 1000,
  geometry: [testLongitude, testLatitude]
}

var testPatchPrivate = {
  _id : "pa.111111.11111.112.211112",
  schema : util.statics.schemaPatch,
  name : "Seahawks Private VIP Club",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: 'place',
  visibility: "private",
}

var testMessage = {
  _id : "me.111111.11111.112.222222",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "Go seahawks!",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"generic",
  },
  _acl: testPatchPublic._id,  // Usually set by client
}

var testResponseMessage = {
  _id : "me.111111.11111.112.111112",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "Repeat! Repeat!",
  _acl: testPatchPublic._id,  // Usually set by client
}

var testMessageToPrivate = {
  _id : "me.111111.11111.112.222223",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "How do I switch views on the suite flat panel screen?",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"generic",
  },
  _acl: testPatchPrivate._id,  // Usually set by client
}

var testResponseToPrivate = {
  _id : "me.111111.11111.112.111113",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "Use the little touch control next to the mini bar",
  _acl: testPatchPrivate._id,  // Usually set by client
}

var testBeacon = {
  _id : 'be.44:44:44:44:44:45',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '44:44:44:44:44:45',
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
  _id : 'be.55:55:55:55:55:56',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label 2',
  ssid: 'Test Beacon 2',
  bssid: '55:55:55:55:55:56',
  signal: -85,
  location: {
    lat:testLatitude,
    lng:testLongitude,
    altitude:12,
    accuracy:30,
    geometry:[testLongitude, testLatitude]
  },
}

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(testUserTom, function(session) {
    userCredTom = 'user=' + session._owner + '&session=' + session.key
    testUtil.getUserSession(testUserBob, function(session) {
      userCredBob = 'user=' + session._owner + '&session=' + session.key
      testUtil.getUserSession(testUserAlice, function(session) {
        userCredAlice = 'user=' + session._owner + '&session=' + session.key
        testUtil.getUserSession(testUserBecky, function(session, user) {
          testUserBecky = user
          testUserBecky.activityDate = testUserBecky.createdDate
          userCredBecky = 'user=' + session._owner + '&session=' + session.key
          testUtil.getUserSession(testUserMax, function(session) {
            userCredMax = 'user=' + session._owner + '&session=' + session.key
            testUtil.getUserSession(testUserStan, function(session) {
              userCredStan = 'user=' + session._owner + '&session=' + session.key
              testUtil.getAdminSession(function(session) {
                adminCred = 'user=' + session._owner + '&session=' + session.key
                test.done()
              })
            })
          })
        })
      })
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Register installs
 * ----------------------------------------------------------------------------
 */

exports.registerInstallOne = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredTom,
    body: {
      install: {
        parseInstallId: 'registration_id_testing_user_tom',
        installId: installId1,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check registger install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId1 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_tom')
      test.done()
    })
  })
}

exports.registerInstallTwo = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredBob,
    body: {
      install: {
        _user: testUserBob._id,
        parseInstallId: 'registration_id_testing_user_bob',
        installId: installId2,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId2 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_bob')
      test.done()
    })
  })
}

exports.registerInstallThree = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredAlice,
    body: {
      install: {
        _user: testUserAlice._id,
        parseInstallId: 'registration_id_testing_user_alice',
        installId: installId3,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'ios',
        deviceVersionName: '8.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId3 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_alice')
      test.done()
    })
  })
}

exports.registerInstallFour = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredBecky,
    body: {
      install: {
        _user: testUserBecky._id,
        parseInstallId: 'registration_id_testing_user_becky',
        installId: installId4,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId4 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_becky')
      test.done()
    })
  })
}

exports.registerInstallFive = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredMax,
    body: {
      install: {
        _user: testUserMax._id,
        parseInstallId: 'registration_id_testing_user_max',
        installId: installId5,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'ios',
        deviceVersionName: '8.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId5 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_max')
      test.done()
    })
  })
}

exports.registerInstallSix = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredStan,
    body: {
      install: {
        _user: testUserStan._id,
        parseInstallId: 'registration_id_testing_user_stan',
        installId: installId6,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'ios',
        deviceVersionName: '7.0.0',
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('updated') > 0 || body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId6 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_stan')
      test.done()
    })
  })
}

exports.updateBeaconsInstallOne = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredTom,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId1
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId1 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].beacons.length === 1)
      t.assert(body.data[0].beaconsDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallThree = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredAlice,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId3
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId3 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].beacons.length === 1)
      t.assert(body.data[0].beaconsDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallFive = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredMax,
    body: {
      location: locationUserMaxNearby,
      installId: installId5
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install location */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId5 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].location)
      t.assert(body.data[0].locationDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallTwo = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredBob,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId2
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId2 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].beacons.length === 1)
      t.assert(body.data[0].beaconsDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallFour = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredBecky,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId4
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId4 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].beacons.length === 1)
      t.assert(body.data[0].beaconsDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallSix = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredStan,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId6
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId6 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].beacons.length === 1)
      t.assert(body.data[0].beaconsDate)
      test.done()
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Messages
 *
 * Tom, Alice and Max are near each other.
 * Bob, Becky and Stan are near each other.
 * ----------------------------------------------------------------------------
 */

exports.tomInsertsPublicPatch = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPatchPublic,    // custom patch
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      location: testPatchPublic.location,
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    activityDate = body.data.activityDate  // For later checks
    /*
     * Alice and Max get notified because they are nearby. Alice via
     * beacon proximity and Max via location distance.
     */
    t.assert(body.notifications.length === 2)
    var tomHit = 0
      , aliceHit = 0
      , maxHit = 0
      , bobHit = 0
      , beckyHit = 0
      , stanHit = 0

    var maxNotification

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testPatchPublic._id || notification.targetId === testPatchPublic._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0) tomHit++
        if (pushId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit++
        if (pushId.indexOf('max') > 0 && notification.trigger == 'nearby') {
          maxHit++
          maxNotification = notification
        }
        if (pushId.indexOf('bob') > 0) bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 1)
    t.assert(maxHit === 1)      // ios 8
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    t.assert(maxNotification.alert)
    t.assert(maxNotification.badge)
    t.assert(maxNotification.trigger)
    t.assert(maxNotification.targetId)

    test.done()
  })
}

exports.bobInsertsPrivatePatch = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testPatchPrivate,
      beacons: [testBeacon2],
      primaryBeaconId: testBeacon2._id,
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    activityDateBobsPatch = body.data.activityDate // for later checks
    /*
     * Becky and Stan should get nearby notifications.
     */
    t.assert(body.notifications.length === 3)
    var tomHit = 0
      , aliceHit = 0
      , maxHit = 0
      , bobHit = 0
      , beckyHit = 0
      , stanHit = 0

    var stanNotification

    var previousModifiedDate = Infinity

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testPatchPrivate._id || notification.targetId === testPatchPrivate._id)

      // Check sort order, issue #376
      t.assert(notification.modifiedDate)
      t.assert(notification.modifiedDate <= previousModifiedDate)
      previousModifiedDate = notification.modifiedDate

      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0) tomHit++
        if (pushId.indexOf('alice') > 0) aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0) bobHit++
        if (pushId.indexOf('becky') > 0 && notification.trigger == 'nearby') beckyHit++
        if (pushId.indexOf('stan') > 0 && notification.trigger == 'nearby') {
          stanHit++
          stanNotification = notification
        }
      })
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 1)   // This was zero prior to 1.10.1, not because Max was not nearby,
                             // but because the test neglected to pass in the location of the
                             // patch as a top-level parameter, even though it was recorded as
                             // the location of the patch
    t.assert(bobHit === 0)
    t.assert(beckyHit === 1)
    t.assert(stanHit === 1)     // ios 7

    t.assert(stanNotification.alert)
    t.assert(stanNotification.badge)
    t.assert(stanNotification.trigger)
    t.assert(stanNotification.targetId)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBob._id)
    t.assert(savedEnt._creator === testUserBob._id)
    t.assert(savedEnt._modifier === testUserBob._id)

    /* Check insert patch */
    t.post({
      uri: '/find/patches',
      body: {
        query:{ _id:testPatchPrivate._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check beacon link count */
      t.post({
        uri: '/find/links',
        body: {
          query: { _to:testBeacon2._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.bobWatchesTomsPublicPatch = function(test) {
  t.post({
    // Deprecated:  use rest api for /data/link
    uri: '/do/insertLink?' + userCredBob,  // owned by tom
    body: {
      toId: testPatchPublic._id,
      fromId: testUserBob._id,
      enabled: true,
      type: util.statics.typeWatch,
      test: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Tom should get a watch alert because he is the patch owner.
     */
    t.assert(body.notifications)
    t.assert(body.notifications.length == 1)
    var tomHit = 0
      , aliceHit = 0
      , maxHit = 0
      , bobHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testPatchPublic._id || notification.targetId === testPatchPublic._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0
          && notification.type === 'watch'
          && notification.trigger == 'own_to'
          && notification.event === 'watch_entity_patch') tomHit++
        if (pushId.indexOf('alice') > 0) aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0) bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPatchPublic._id,
          _from: testUserBob._id,
          type: util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0].enabled === true)
      test.done()
    })
  })
}

exports.bobLikesTomsPublicPatchViaRestAPI = function(test) {
  t.post({
    // Supported API
    uri: '/data/links?' + userCredBob,  // owned by tom
    body: {
      data: {
        _to: testPatchPublic._id,
        _from: testUserBob._id,
        type: 'like',
      },
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.notifications)
    // Tom should get a like alert because he is the patch owner.
    t.assert(body.notifications.length == 1)
    var tomHit = 0
      , aliceHit = 0
      , maxHit = 0
      , bobHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testPatchPublic._id || notification.targetId === testPatchPublic._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0
          && notification.type === 'like'
          && notification.trigger == 'own_to'
          && notification.event === 'like_entity_patch') tomHit++
        if (pushId.indexOf('alice') > 0) aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0) bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPatchPublic._id,
          _from: testUserBob._id,
          type: util.statics.typeLike
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0].enabled === true)
      test.done()
    })
  })
}

exports.beckyRequestsToWatchBobsPrivatePatch = function(test) {
  var activityDateUser
  var activityDatePatch

  /* Stash activityDates */
  t.get('/data/users/' + testUserBecky._id, function(err, res, body) {
    activityDateUser = body.data.activityDate
    t.assert(activityDateUser)
    t.get('/data/patches/' + testPatchPrivate._id, function(err, res, body) {
      activityDatePatch = body.data.activityDate
      t.assert(activityDatePatch)
      execute()
    })
  })

  function execute() {
    t.post({
      // Deprecated: use /data/link
      uri: '/do/insertLink?' + userCredBecky,
      body: {
        toId: testPatchPrivate._id,             // Owned by bob
        fromId: testUserBecky._id,
        type: util.statics.typeWatch,
        enabled: false,
        test: true,
        log: true,
      }
    }, 201, function(err, res, body) {
      t.assert(body.count === 1)
      /*
       * Bob should get a request alert because he is the patch owner.
       */
      t.assert(body.notifications.length == 1)
      var tomHit = 0
        , aliceHit = 0
        , maxHit = 0
        , bobHit = 0
        , beckyHit = 0
        , stanHit = 0

      body.notifications.forEach(function(message) {
        var notification = message.notification
        t.assert(notification._target === testPatchPrivate._id || notification.targetId === testPatchPrivate._id)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0) aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0
            && notification.type === 'watch'
            && notification.trigger == 'own_to'
            && notification.event === 'request_watch_entity') bobHit++
          if (pushId.indexOf('becky') > 0) beckyHit++
          if (pushId.indexOf('stan') > 0) stanHit++
        })
      })

      t.assert(tomHit === 0)
      t.assert(aliceHit === 0)
      t.assert(maxHit === 0)
      t.assert(bobHit === 1)
      t.assert(beckyHit === 0)
      t.assert(stanHit === 0)

      /* Check watch entity link to entity 2 */
      t.post({
        uri: '/find/links',
        body: {
          query: {
            _to: testPatchPrivate._id,
            _from: testUserBecky._id,
            type: util.statics.typeWatch
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data[0].enabled === false)
        beckyWatchLinkId = body.data[0]._id

        /* Check activityDate updated for patch and user */
        t.get('/data/users/' + testUserBecky._id, function(err, res, body) {
          t.assert(body.data.activityDate >= activityDateUser, activityDateUser)

          t.get('/data/patches/' + testPatchPrivate._id, function(err, res, body) {
            t.assert(body.data.activityDate >= activityDatePatch, activityDatePatch)
            test.done()
          })
        })
      })
    })
  }
}

exports.bobApprovesBeckysRequestToWatchBobsPrivatePatch = function(test) {
  var activityDateUser
  var activityDatePatch

  /* Stash activityDates */
  t.get('/data/users/' + testUserBecky._id, function(err, res, body) {
    activityDateUser = body.data.activityDate
    t.assert(activityDateUser)
    t.get('/data/patches/' + testPatchPrivate._id, function(err, res, body) {
      activityDatePatch = body.data.activityDate
      t.assert(activityDatePatch)
      execute()
    })
  })

  function execute() {
    t.post({
      // Deprecated: use /data/link
      uri: '/do/insertLink?' + userCredBob,
      body: {
        linkId: beckyWatchLinkId,
        toId: testPatchPrivate._id,       // Owned by bob
        fromId: testUserBecky._id,
        type: util.statics.typeWatch,
        enabled: true,
        test: true,  // sets activityDateWindow to 0
        debug: false,
      }
    }, 201, function(err, res, body) {
      t.assert(body.count === 1)
      /*
       * Becky should get a request alert because she is the requestor.
       */
      t.assert(body.notifications.length == 1)

      var tomHit = 0
        , aliceHit = 0
        , maxHit = 0
        , bobHit = 0
        , beckyHit = 0
        , stanHit = 0

      body.notifications.forEach(function(message) {
        var notification = message.notification
        t.assert(notification._target == testPatchPrivate._id)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0) aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0
            && notification.type === 'watch'
            && notification.trigger == 'own_from'
            && notification.event === 'approve_watch_entity') beckyHit++
          if (pushId.indexOf('stan') > 0) stanHit++
        })
      })

      t.assert(tomHit === 0)
      t.assert(aliceHit === 0)
      t.assert(maxHit === 0)
      t.assert(bobHit === 0)
      t.assert(beckyHit === 1)
      t.assert(stanHit === 0)

      /* Check watch entity link to entity 2 */
      t.post({
        uri: '/find/links',
        body: {
          query: {
            _to: testPatchPrivate._id,
            _from: testUserBecky._id,
            type: util.statics.typeWatch
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data[0].enabled === true)

        /* Check activityDate updated for patch and user */
        t.get('/data/users/' + testUserBecky._id, function(err, res, body) {
          t.assert(body.data.activityDate >= activityDateUser)

          t.get('/data/patches/' + testPatchPrivate._id, function(err, res, body) {
            t.assert(body.data.activityDate >= activityDatePatch)
            test.done()
          })
        })
      })
    })
  }
}

/*
 * ----------------------------------------------------------------------------
 * Add another watcher to Bobs private patch for later testing scenarios.
 * ----------------------------------------------------------------------------
 */

exports.aliceRequestsToWatchBobsPrivatePatch = function(test) {
  t.post({
    // Deprecated: use /data/link
    uri: '/do/insertLink?' + userCredAlice,
    body: {
      toId: testPatchPrivate._id,             // Owned by bob
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: false,
      // actionEvent: 'request_watch_entity',
      test: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPatchPrivate._id,
          _from: testUserAlice._id,
          type: util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0].enabled === false)
      aliceWatchLinkId = body.data[0]._id
      test.done()
    })
  })
}

exports.bobApprovesAlicesRequestToWatchBobsPrivatePatch = function(test) {
  t.post({
    // Deprecated: use /data/link
    uri: '/do/insertLink?' + userCredBob,
    body: {
      linkId: aliceWatchLinkId,
      toId: testPatchPrivate._id,       // Owned by bob
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: true,
      test: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

/*
 * ----------------------------------------------------------------------------
 *
 * Users
 * - Tom owns the public patch
 * - Bob owns the private patch
 *
 * - Tom, Alice and Max are all near each other
 * - Bob, Becky and Stan are far away and near each other
 *
 * - Bob is watching the public patch and is far away
 * - Becky is watching the private patch and is nearby
 * - Alice is watching the private patch and is far away
 *
 * - Alice and Max are nearby the public patch
 * - Becky and Stan are nearby the private patch
 *
 * - Stan and Max are not watching or owners of any patches
 *
 * Message scenarios: Notified because:
 * - I own the patch
 *      (Tom gets notified when Becky posts message to patch)
 * - I am watching the patch
 *      (Bob gets notified when Becky or Alice post messages to patch)
 * - I am nearby the patch
 *      (Alice and Max get notified when Becky posts message to patch)
 *
 * ----------------------------------------------------------------------------
 */

exports.beckyInsertsMessageToTomsPublicPatch = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: testMessage,
      links: [{
        _to: testPatchPublic._id,     // Toms patch watched by Bob, Alice and Max are nearby
        type: util.statics.typeContent
      }],
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he autowatched the patch.
     * Bob gets notified because he is watching the patch.
     * Alice is near the patch but does not get notified.
     * Max is near the patch with good accuracy, but does not get notified
     * Becky does not get notified because she is the sender.
     * Stan does not get notified because he isn't nearby.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testMessage._id || notification.targetId === testMessage._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0 && notification.trigger == 'watch_to') tomHit++
        if (pushId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit++
        if (pushId.indexOf('max') > 0 && notification.trigger == 'nearby') maxHit++
        if (pushId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 1)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:testMessage._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0]._acl === testPatchPublic._id)

      /* Check link */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPatchPublic._id,
            _from: testMessage._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserTom._id)  // strong links to entites are owned by ent owner

        /* Check activityDate for patch */
        t.post({
          uri: '/find/patches',
          body: {
            query:{ _id:testPatchPublic._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate >= activityDate)
          test.done()
        })
      })
    })
  })
}

exports.deleteBeckysMessage = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + userCredBecky,
    body: {
      entityId:testMessage._id,
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.maxWithPoorLocationAccuracy = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredMax,
    body: {
      location: locationUserMaxPoorAccuracy,   // Same location as previous but real bad accuracy
      installId: installId5
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)
    test.done()
  })
}

exports.beckyInsertsMessageToTomsPublicPatchMaxPoorAccuracy = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: testMessage,
      links: [{
        _to: testPatchPublic._id,     // Toms patch watched by Bob, Alice and Max are nearby
        type: util.statics.typeContent
      }],
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he autowatches the patch.
     * Bob gets notified because he is watching the patch.
     * Alice does not gets notified because she is nearby the patch.
     * Max does *not* get notified because he is nearby the patch but location accuracy is poor.
     * Becky does not get notified because she is the sender.
     * Stan does not get notified because he isn't nearby.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testMessage._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0 && notification.trigger == 'watch_to') tomHit++
        if (pushId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit++
        if (pushId.indexOf('max') > 0 ) maxHit++
        if (pushId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 1)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    test.done()
  })
}

exports.deleteBeckysMessageSecondTime = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + userCredBecky,
    body: {
      entityId:testMessage._id,
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.maxMovesSoNotNearby = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredMax,
    body: {
      location: locationUserMaxNotNearby,
      installId: installId5
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)
    test.done()
  })
}

exports.beckyInsertsMessageToTomsPublicPatchMaxNotNearby = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: testMessage,
      links: [{
        _to: testPatchPublic._id,     // Toms patch watched by Bob
        type: util.statics.typeContent
      }],
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he autowatch the patch.
     * Bob gets notified because he is watching the patch.
     * Alice does not get notified even thought she is near the patch.
     * Max does *not* get notified because he is *not* nearby the patch.
     * Becky does not get notified because she is the sender.
     * Stan does not get notified because he isn't nearby.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testMessage._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0 && notification.trigger == 'watch_to') tomHit++
        if (pushId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 1)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    test.done()
  })
}

exports.maxMovesNearby = function (test) {
  t.post({
    uri: '/do/updateProximity?' + userCredMax,
    body: {
      location: locationUserMaxNearby,
      installId: installId5
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)
    test.done()
  })
}

exports.aliceInsertsResponseMessageToTomsPublicPatch = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredAlice,
    body: {
      entity: testResponseMessage,
      links: [
         { _to: testPatchPublic._id,          // Toms patch
            type: util.statics.typeContent },
        ],
      test: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he owns the patch.
     * Bob gets notified because he is watching the patch.
     * Max does not get notified even though he is near the patch.
     */

    /*
     * If not run stand-alone, Alice created in previous test module
     * gets a message because she is watching Tom.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0 && notification.trigger == 'watch_to') tomHit++
        if (pushId.indexOf('alice') > 0) aliceHit++
        if (pushId.indexOf('max') > 0 && notification.trigger == 'nearby') maxHit++
        if (pushId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 1)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 1)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserAlice._id)
    t.assert(savedEnt._creator === testUserAlice._id)
    t.assert(savedEnt._modifier === testUserAlice._id)
    var activityDate = savedEnt.activityDate

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredAlice,
      body: {
        query:{ _id:testResponseMessage._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link to patch */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPatchPublic._id,
            _from: testResponseMessage._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserAlice._id)
        t.assert(link._owner === testUserTom._id)     // strong links to entites are owned by ent owner

        /* Check activityDate for patch */
        t.post({
          uri: '/find/patches',
          body: {
            query:{ _id:testPatchPublic._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate >= activityDate)
          test.done()
        })
      })
    })
  })
}

exports.beckyInsertsMessageToBobsPrivatePatch = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: testMessageToPrivate,
      links: [{
        _to: testPatchPrivate._id,     // Bobs patch watched by Becky
        type: util.statics.typeContent
      }],
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Bob gets notified because he autowatches the patch.
     * Alice get notified as a member.
     * Becky DOES NOT get notified as a member because she is the author.
     */
    t.assert(body.notifications.length === 2)  // alice is ios, bob is android

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === testMessageToPrivate._id ||
          notification.targetId === testMessageToPrivate._id)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0) tomHit++
        if (pushId.indexOf('alice') > 0 && notification.trigger == 'watch_to') aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0) stanHit++
      })
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 1)
    t.assert(maxHit === 0)
    t.assert(bobHit === 1)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:testMessageToPrivate._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0]._acl === testPatchPrivate._id)

      /* Check link */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPatchPrivate._id,
            _from: testMessageToPrivate._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserBob._id)  // strong links to entites are owned by ent owner

        /* Check activityDate for patch */
        t.post({
          uri: '/find/patches',
          body: {
            query:{ _id:testPatchPrivate._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate >= activityDate)
          test.done()
        })
      })
    })
  })
}

exports.bobInsertsResponseToBeckysPrivateMessage = function (test) {

  // Alice mutes her watch link to testPatchPrivate
  t.post({
    uri: '/data/links/' + aliceWatchLinkId + '?' + userCredAlice,
    body: { data: {mute: true}},
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._to === testPatchPrivate._id)
    t.assert(body.data.mute)
    t.post({
      uri: '/do/insertEntity?' + userCredBob,
      body: {
        entity: testResponseToPrivate,
        links: [
           { _to: testPatchPrivate._id,                   // Bobs patch
              type: util.statics.typeContent },
          ],
        test: true,
        activityDateWindow: 0,
      }
    }, 201, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data)
      /*
       * Becky and Alice get notified because they are watching the patch.
       * Bob DOES NOT get notified as the owner of the patch because is the message author.
       */

      /*
       * If not run stand-alone, Alice create in previous test module
       * gets a message because she is watching tom.
       */
      t.assert(body.notifications.length === 2)

      var tomHit = 0
        , bobHit = 0
        , aliceHit = 0
        , maxHit = 0
        , beckyHit = 0
        , stanHit = 0

      body.notifications.forEach(function(message) {
        var notification = message.notification
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0 && notification.trigger == 'watch_to') {
            aliceHit++
            // Alice muted her watch link earlier in the test.  She has an ios install.
            // See the mini spec here:  https://github.com/3meters/proxibase/issues/347
            t.assert(notification.priority === 2)
            t.assert(notification["sound-x"])
            t.assert(notification["alert-x"])
            t.assert(!notification.sound)
            t.assert(!notification.notification)
          }
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0 && notification.trigger == 'watch_to') beckyHit++
          if (pushId.indexOf('stan') > 0) stanHit++
        })
      })

      t.assert(tomHit === 0)
      t.assert(aliceHit === 1)
      t.assert(maxHit === 0)
      t.assert(bobHit === 0)
      t.assert(beckyHit === 1)
      t.assert(stanHit === 0)

      var savedEnt = body.data
      t.assert(savedEnt._owner === testUserBob._id)
      t.assert(savedEnt._creator === testUserBob._id)
      t.assert(savedEnt._modifier === testUserBob._id)
      var activityDate = savedEnt.activityDate

      /* Check insert */
      t.post({
        uri: '/find/messages?' + userCredBob,
        body: {
          query:{ _id:testResponseToPrivate._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)

        /* Check link to patch */
        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              _to: testPatchPrivate._id,
              _from: testResponseToPrivate._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          t.assert(link._creator === testUserBob._id)
          t.assert(link._owner === testUserBob._id)     // strong links to entites are owned by ent owner

          /* Check activityDate for patch */
          t.post({
            uri: '/find/patches',
            body: {
              query:{ _id:testPatchPrivate._id }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data && body.data[0])
            t.assert(body.data[0].activityDate >= activityDate)
            test.done()
          })
        })
      })
    })
  })
}

exports.memberBeckyGetsMessagesForBobsPrivatePatch = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredBecky,
    body: {
      entityId: testPatchPrivate._id,
      cursor: {
        linkTypes: ['content'],
        schemas: ['message'],
        direction: 'in',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
      },
    }
  },

  function(err, res, body) {
    /*
     * Should see two messages.
     */
    t.assert(body.data)
    t.assert(body.count === 2)
    test.done()
  })
}

exports.ownerBobGetMessagesForBobsPrivatePatch = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredBob,
    body: {
      entityId: testPatchPrivate._id,
      cursor: {
        linkTypes: ['content'],
        schemas: ['message'],
        direction: 'in',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
      },
    }
  },

  function(err, res, body) {
    /*
     * Should see two messages.
     */
    t.assert(body.data)
    t.assert(body.count === 2)
    test.done()
  })
}

exports.nonMemberStanCantGetMessagesForBobsPrivatePatch = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredStan,
    body: {
      entityId: testPatchPrivate._id,
      cursor: {
        linkTypes: ['content'],
        schemas: ['message'],
        direction: 'in',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
      },
    }
  },

  function(err, res, body) {
    /*
     * Should see two messages.
     */
    t.assert(body.data)
    t.assert(body.count === 0)
    test.done()
  })
}

exports.nonMemberStanCanGetMembersForBobsPrivatePatch = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredStan,
    body: {
      entityId: testPatchPrivate._id,
      cursor: {
        linkTypes: ['watch'],
        schemas: ['user'],
        direction: 'in',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
        where: { 'enabled': true },
      },
    }
  },

  function(err, res, body) {
    /*
     * Should see three watchers (Becky and Alice, plus Bob's autowatch)
     */
    t.assert(body.data)
    t.assert(body.count === 3)
    test.done()
  })
}

exports.tomCanGetMessageToTomsPublicPatch = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredTom,
    body: {
      entityIds: [testMessage._id],
      links : {
        shortcuts: true,
        active:
        [ { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' } ]
      }
    }
  },

  function(err, res, body) {
    // Should see Bobs message
    t.assert(body.data)
    t.assert(body.count === 1)
    test.done()
  })
}

exports.bobCanPreviewMessageCountsByProximity = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCredBob,
    body: {
      installId: installId1,
      cursor: { skip: 0, limit: 50, sort: { modifiedDate: -1 }},
      links: { shortcuts: false,
         active:
          [ { schema: 'beacon', limit: 10, links: true, type: 'proximity', count: true, direction: 'both' },
            { schema: 'message', limit: 2, links: true, type: 'content', count: true, direction: 'both' }]
      },
      beaconIds: [ testBeacon._id, testBeacon2._id ],
    }
  },

  function(err, res, body) {
    t.assert(body.data && body.data.length >= 2)
    /*
     * Includes one private and one public patch.
     * Counts are available but not message content for either.
     */
    var privatePatch = body.data[0]
    t.assert(privatePatch._id === testPatchPrivate._id)
    t.assert(!privatePatch.linksIn)
    t.assert(!privatePatch.linksOut)
    t.assert(privatePatch.linksOutCounts[0].schema === 'beacon')
    t.assert(privatePatch.linksOutCounts[0].count === 1)

    var publicPatch = body.data[1]
    t.assert(!publicPatch.linksIn)
    t.assert(!publicPatch.linksOut)
    t.assert(publicPatch.linksInCounts && publicPatch.linksInCounts.length === 1)
    t.assert(publicPatch.linksInCounts[0].schema === 'message')
    t.assert(publicPatch.linksInCounts[0].count === 2)
    t.assert(publicPatch.linksOutCounts && publicPatch.linksOutCounts.length === 1)
    t.assert(publicPatch.linksOutCounts[0].schema === 'beacon')
    t.assert(publicPatch.linksOutCounts[0].count === 1)
    test.done()
  })
}

/*
 * ----------------------------------------------------------------------------
 * Notifications feed
 * ----------------------------------------------------------------------------
 */

exports.tomCanGetNotificationsForSelf = function (test) {
  t.post({
    uri: '/do/getNotifications?' + userCredTom,
    body: {
      entityId: testUserTom._id,
      cursor: {
        skip: 0,
        limit: 50,
      },
    }
  },

  function(err, res, body) {
    // Should see Bob watching Tom's patch
    // Note: this test file does not stand on it's own because
    // an earlier test file is creating another watch.
    t.assert(body.data)
    t.assert(body.data.length)
    var cBob = 0
    var cBecky = 0
    var cAlice = 0
    var cTom = 0
    var prev = Infinity
    body.data.forEach(function(msg) {
      // Issue #376
      t.assert(msg.modifiedDate)
      t.assert(msg.modifiedDate <= prev)
      prev = msg.modifiedDate
      if (msg.name === 'Tom') cTom++
      if (msg.name === 'Bob') cBob++
      if (msg.name === 'Becky') cBecky++
      if (msg.name === 'Alice') cAlice++
    })
    t.assert(cBob)
    t.assert(cAlice)
    t.assert(cBecky)
    t.assert(!cTom)
    test.done()
  })
}

exports.tomCanGetNotificationsForSelfUserApiPost = function (test) {
  t.post({
    uri: '/user/feed?' + userCredTom,
    body: {
      sort: { modifiedDate: -1 },
      limit: 2,
    }
  },
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 2)
    test.done()
  })
}

exports.tomCanGetNotificationsForSelfUserApiGet = function (test) {
  t.get('/user/feed?' + userCredTom + '&limit=3',
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 3)
    test.done()
  })
}

/*
 * ----------------------------------------------------------------------------
 * Sharing
 * ----------------------------------------------------------------------------
 */

var beckySharePatchWithStanId = "me.111111.11111.111.222224"
var beckyShareMessageWithStanId = "me.111111.11111.111.222225"
var beckyShareMessageWithAliceId = "me.111111.11111.111.222226"
var beckySharePhotoWithStanId = "me.111111.11111.111.222227"
var beckySharePhotoWithAliceId = "me.111111.11111.111.222228"

exports.beckySharesPrivatePatchWithStan = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: {
        _id : beckySharePatchWithStanId,
        schema : util.statics.schemaMessage,
        type : "share",
        description : "Checkout the \'Seahawks Private VIP Club\' patch!",
      },
      links: [{
        type: 'share',
        _to: testPatchPrivate._id,
      }, {
        type: 'share',
        _to: testUserStan._id,
      }],
      test: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    var messageDate = body.data.modifiedDate  // For later checks
    /*
     * Stan gets notified as the recipient.
     */

    t.assert(body.notifications)
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      t.assert(notification._target === beckySharePatchWithStanId || notification.targetId === beckySharePatchWithStanId)
      message.pushIds.forEach(function(pushId){
        if (pushId.indexOf('tom') > 0) tomHit++
        if (pushId.indexOf('alice') > 0) aliceHit++
        if (pushId.indexOf('max') > 0) maxHit++
        if (pushId.indexOf('bob') > 0) bobHit++
        if (pushId.indexOf('becky') > 0) beckyHit++
        if (pushId.indexOf('stan') > 0 && notification.trigger == 'share') stanHit++
      })
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 1)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:beckySharePatchWithStanId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check links */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            type: 'share',
            _from: beckySharePatchWithStanId,
            _to: testPatchPrivate._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        /* Bob owns the patch */
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserBob._id)
        t.assert(link._modifier === testUserBecky._id)

        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              type: 'share',
              _from: beckySharePatchWithStanId,
              _to: testUserStan._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          /* Stan owns the user */
          t.assert(link._creator === testUserBecky._id)
          t.assert(link._owner === testUserStan._id)
          t.assert(link._modifier === testUserBecky._id)

          /* Check activityDate for patch - should not have changed */
          // Behavior changed 7/15/16.  Share links are now strong
          t.post({
            uri: '/find/patches',
            body: {
              query:{ _id:testPatchPrivate._id }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data && body.data[0])
            t.assert(body.data[0].activityDate > messageDate)
            test.done()
          })
        })
      })
    })
  })
}

exports.beckySharesMemberMessageWithNonMemberStan = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: {
        _id : beckyShareMessageWithStanId,
        schema : util.statics.schemaMessage,
        type : "share",
        description : "Checkout Becky\'s message to the \'Seahawks Private VIP Club\' patch!",
      },
      links: [{
        type: 'share',
        _to: testMessageToPrivate._id,
      }, {
        type: 'share',
        _to: testUserStan._id,
      }],
      test: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      if (!message.info) {
        t.assert(notification._target === beckyShareMessageWithStanId || notification.targetId === beckyShareMessageWithStanId)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0) aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0) beckyHit++
          if (pushId.indexOf('stan') > 0 && notification.trigger == 'share') stanHit++
        })
      }
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 1)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:beckyShareMessageWithStanId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check links */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            type: 'share',
            _from: beckyShareMessageWithStanId,
            _to: testMessageToPrivate._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        /* Bob owns the patch */
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserBecky._id)
        t.assert(link._modifier === testUserBecky._id)

        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              type: 'share',
              _from: beckyShareMessageWithStanId,
              _to: testUserStan._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          /* Stan owns the user */
          t.assert(link._creator === testUserBecky._id)
          t.assert(link._owner === testUserStan._id)
          t.assert(link._modifier === testUserBecky._id)

          test.done()
        })
      })
    })
  })
}

exports.beckySharesMemberMessageWithMemberAlice = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: {
        _id : beckyShareMessageWithAliceId,
        schema : util.statics.schemaMessage,
        type : "share",
        description : "Checkout Becky\'s message to the \'Seahawks Private VIP Club\' patch!",
        _acl : testPatchPrivate._id,
      },
      links: [{
        type: 'share',
        _to: testMessageToPrivate._id,
      }, {
        type: 'share',
        _to: testUserAlice._id,
      }],
      test: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.data._acl && body.data._acl.length)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      if (!notification.info) {
        t.assert(notification.targetId === beckyShareMessageWithAliceId)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0 && notification.trigger == 'share') aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0) beckyHit++
          if (pushId.indexOf('stan') > 0) stanHit++
        })
      }
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 1)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:beckyShareMessageWithAliceId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check links */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            type: 'share',
            _from: beckyShareMessageWithAliceId,
            _to: testMessageToPrivate._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        /* Bob owns the patch */
        t.assert(link._owner === testUserBecky._id)
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._modifier === testUserBecky._id)

        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              type: 'share',
              _from: beckyShareMessageWithAliceId,
              _to: testUserAlice._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          /* Stan owns the user */
          t.assert(link._owner === testUserAlice._id)
          t.assert(link._creator === testUserBecky._id)
          t.assert(link._modifier === testUserBecky._id)

          test.done()
        })
      })
    })
  })
}

exports.beckySharesPhotoWithNonMemberStan = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: {
        _id : beckySharePhotoWithStanId,
        schema : util.statics.schemaMessage,
        type : "share",
        description : "Checkout Becky\'s photo!",
        photo: {
          prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
          source:"generic",
        },
      },
      links: [{
        type: 'share',
        _to: testUserStan._id,
      }],
      test: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      if (!notification.info) {
        t.assert(notification._target === beckySharePhotoWithStanId || notification.targetId === beckySharePhotoWithStanId)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0) aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0) beckyHit++
          if (pushId.indexOf('stan') > 0 && notification.trigger == 'share') stanHit++
        })
      }
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 0)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 1)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:beckySharePhotoWithStanId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            type: 'share',
            _from: beckySharePhotoWithStanId,
            _to: testUserStan._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        /* Stan owns the user */
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserStan._id)
        t.assert(link._modifier === testUserBecky._id)

        test.done()
      })
    })
  })
}

exports.beckySharesPhotoWithMemberAlice = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: {
        _id : beckySharePhotoWithAliceId,
        schema : util.statics.schemaMessage,
        type : "share",
        description : "Checkout Becky\'s photo!",
        photo: {
          prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
          source:"generic",
        },
      },
      links: [{
        type: 'share',
        _to: testUserAlice._id,
      }],
      test: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = 0
      , bobHit = 0
      , aliceHit = 0
      , maxHit = 0
      , beckyHit = 0
      , stanHit = 0

    body.notifications.forEach(function(message) {
      var notification = message.notification
      if (!message.info) {
        t.assert(notification.targetId === beckySharePhotoWithAliceId)
        message.pushIds.forEach(function(pushId){
          if (pushId.indexOf('tom') > 0) tomHit++
          if (pushId.indexOf('alice') > 0 && notification.trigger == 'share') aliceHit++
          if (pushId.indexOf('max') > 0) maxHit++
          if (pushId.indexOf('bob') > 0) bobHit++
          if (pushId.indexOf('becky') > 0) beckyHit++
          if (pushId.indexOf('stan') > 0) stanHit++
        })
      }
    })

    t.assert(tomHit === 0)
    t.assert(aliceHit === 1)
    t.assert(maxHit === 0)
    t.assert(bobHit === 0)
    t.assert(beckyHit === 0)
    t.assert(stanHit === 0)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBecky._id)
    t.assert(savedEnt._creator === testUserBecky._id)
    t.assert(savedEnt._modifier === testUserBecky._id)

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBecky,
      body: {
        query:{ _id:beckySharePhotoWithAliceId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check links */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            type: 'share',
            _from: beckySharePhotoWithAliceId,
            _to: testUserAlice._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        /* Stan owns the user */
        t.assert(link._owner === testUserAlice._id)
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._modifier === testUserBecky._id)

        test.done()
      })
    })
  })
}

exports.stanGetsSharePatchFromBecky = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredStan,
    body: {
      entityIds: [beckySharePatchWithStanId],
      links : {
        shortcuts: true,
        active:
        [
          { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' },
        ]
      }
    }
  },

  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 1)

    /* Should have share links to message */
    t.assert(!body.data[0].linksIn)
    t.assert(body.data[0].linksOut && body.data[0].linksOut.length === 2)
    t.assert(body.data[0].linksOutCounts && body.data[0].linksOutCounts.length === 2)

    var patchHit = 0
      , userHit = 0

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserStan._id) userHit++
      if (link.type === 'share'
          && link.targetSchema === 'patch'
          && link.shortcut
          && link.shortcut.id === testPatchPrivate._id) patchHit++
    })

    t.assert(patchHit === 1)
    t.assert(userHit === 1)

    test.done()
  })
}

exports.stanGetsSharePhotoFromBecky = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredStan,
    body: {
      entityIds: [beckySharePhotoWithStanId],
      links : {
        shortcuts: true,
        active:
        [
          { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' },
        ]
      }
    }
  },

  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 1)

    /* - Link to Stan */
    t.assert(!body.data[0].linksIn)
    t.assert(body.data[0].linksOut && body.data[0].linksOut.length === 1)
    t.assert(body.data[0].linksOutCounts && body.data[0].linksOutCounts.length === 1)

    var userHit = 0

    var link = body.data[0].linksOut[0]
    t.assert(link.type === 'share'
        && link.targetSchema === 'user'
        && link.shortcut
        && link.shortcut.id === testUserStan._id)

    test.done()
  })
}

exports.aliceGetsSharePhotoFromBecky = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredAlice,
    body: {
      entityIds: [beckySharePhotoWithAliceId],
      links : {
        shortcuts: true,
        active:
        [
          { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' },
        ]
      }
    }
  },

  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 1)

    /* - Link to Stan */
    t.assert(!body.data[0].linksIn)
    t.assert(body.data[0].linksOut && body.data[0].linksOut.length === 1)
    t.assert(body.data[0].linksOutCounts && body.data[0].linksOutCounts.length === 1)

    var userHit = 0

    var link = body.data[0].linksOut[0]
    t.assert(link.type === 'share'
        && link.targetSchema === 'user'
        && link.shortcut
        && link.shortcut.id === testUserAlice._id)

    test.done()
  })
}

exports.stanGetsShareMessageFromBecky = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredStan,
    body: {
      entityIds: [beckyShareMessageWithStanId],
      links : {
        shortcuts: true,
        active:
        [
          { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' },
        ]
      }
    }
  },

  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 1)

    /*
     * - Link to Stan
     * - Link to message but no shortcut because Stan is not a member of the
     *   private patch the message is from.
     */
    t.assert(!body.data[0].linksIn)
    t.assert(body.data[0].linksOut && body.data[0].linksOut.length === 2)
    t.assert(body.data[0].linksOutCounts && body.data[0].linksOutCounts.length === 2)

    var messageHit = 0
      , userHit = 0

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserStan._id) userHit++
      if (link.type === 'share'
          && link.targetSchema === 'message'
          && !link.shortcut) messageHit++
    })

    t.assert(messageHit === 1)
    t.assert(userHit === 1)

    test.done()
  })
}

exports.aliceGetsShareMessageFromBecky = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredAlice,
    body: {
      entityIds: [beckyShareMessageWithAliceId],
      links : {
        shortcuts: true,
        active:
        [
          { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' },
        ]
      }
    }
  },

  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 1)

    /*
     * - Link to Stan
     * - Link to message with shortcut because Alice is a member of the
     *   private patch the message is from.
     */
    t.assert(!body.data[0].linksIn)
    t.assert(body.data[0].linksOut && body.data[0].linksOut.length === 2)
    t.assert(body.data[0].linksOutCounts && body.data[0].linksOutCounts.length === 2)

    var messageHit = 0
      , userHit = 0

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserAlice._id) userHit++
      if (link.type === 'share'
          && link.targetSchema === 'message'
          && link.shortcut
          && link.shortcut.id === testMessageToPrivate._id) messageHit++
    })

    t.assert(userHit === 1)
    t.assert(messageHit === 1)  // can see preview -- added in feb 2015 -- no longer have to drill in -george


    // Make a second call to view the contents of the shared message to the private place
    // This is no longer necessary
    t.post({
      uri: '/do/getEntities?' + userCredAlice,
      body: {
        entityIds: [testMessageToPrivate._id]
      }
    },

    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.length === 1)
      t.assert(body.data[0].description)
      test.done()
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Sent messages
 * ----------------------------------------------------------------------------
 */

exports.userGetMessagesSentByAlice = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredTom,
    body: {
      log: true,
      entityId: testUserAlice._id,
      cursor: {
        linkTypes: ['create'],
        schemas: ['message'],
        direction: 'out',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
      },
      links : {
        shortcuts: true,
        active:
        [ { schema: 'patch', limit: 1, links: true, type: 'content', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'content', count: true, direction: 'both' },
          { schema: 'patch', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'message', limit: 1, links: true, type: 'share', count: true, direction: 'out' },
          { schema: 'user', limit: 5, links: true, type: 'share', count: true, direction: 'out' } ]
      }
    }
  },

  function(err, res, body) {
    // Should not see alices reply message from above
    t.assert(body.data)
    // George changed.  I think it is ok to see her messages to public patches
    // t.assert(body.count === 0)
    t.assert(body.count === 1)
    test.done()
  })
}

// Relies on sample data from genData
exports.messagePagingRest = function(test) {
  t.get('/find/messages?limit=10&sort=_id&' + adminCred,
  function(err, res, body) {
    t.assert(body.data.length === 10)
    t.assert('Message 0' === body.data[0].name)
    t.get('/find/messages?limit=10&sort=_id&skip=10&' + adminCred,
    function(err, res, body) {
      t.assert(body.data.length === 10)
      t.assert('Message 10' === body.data[0].name)
      test.done()
    })
  })
}

exports.messagePagingRestLinks = function(test) {
  t.get('/find/patches/' + patch1Id + '?linked[from]=messages&linked[type]=content&' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.linked)
    t.assert(body.data.linked.length = messagesPerPatch)
    t.get('/find/patches/' + patch1Id + '?linked[from]=messages&linked[type]=content&linked[limit]=2&linked[skip]=2&linked[sort]=_id&' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.linked)
      t.assert(body.data.linked.length === 2)
      t.assert(body.data.linked[0].name === 'Message 2')  // skipped messages 0 and 1
      test.done()
    })
  })
}

exports.removeMessageFromPatch = function(test) {
  t.post({
    uri: '/do/removeLinks?' + userCredTom,  // patch owner
    body: {
      toId: testPatchPublic._id,
      fromId: testMessage._id,              // owned by bob
      type: util.statics.typeContent,
      // actionEvent: 'remove'
    }
  }, function(err, res, body) {
    t.assert(!err)
    t.assert(body.info.indexOf('success') > 0)

    /* Check removed entity */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _to:testPatchPublic._id,
          _from:testMessage._id,            // owned by bob
          type:util.statics.typeContent
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

exports.unwatchPrivatePatch = function(test) {
  t.post({
    uri: '/do/deleteLink?' + userCredBecky,  // Deprecated:  just DELETE /data/links/<linkId>
    body: {
      toId: testPatchPrivate._id,             // Owned by bob
      fromId: testUserBecky._id,
      type: util.statics.typeWatch,
      // actionEvent: 'unwatch_entity_patch',  // now constructed automaticlly
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.deprecated) // Just DELETE /data/links/<linkId>

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPatchPrivate._id,
          _from: testUserBecky._id,
          type: util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

exports.formerMemberGetMessagesForPrivatePatch = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCredBecky,
    body: {
      entityId: testPatchPrivate._id,
      log: true,
      cursor: {
        linkTypes: ['content'],
        schemas: ['message'],
        direction: 'in',
        skip: 0,
        sort: { modifiedDate: -1},
        limit: 50,
      },
    }
  },

  function(err, res, body) {
    /*
     * Becky can still ready messages to a private patch
     * that she posted, but she cannot see anybody elses
     * 
     * This is a change in behavior introduced in 2.4
     */
    t.assert(body.data)
    t.assert(body.data.length)
    body.data.forEach(function(msg) {
      t.assert(msg._owner === testUserBecky._id)
    })
    test.done()
  })
}
