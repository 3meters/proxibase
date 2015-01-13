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
var installId1 = '5905d547-8321-4612-abe1-00001'
var installId2 = '5905d547-8321-4612-abe1-00002'
var installId3 = '5905d547-8321-4612-abe1-00003'
var installId4 = '5905d547-8321-4612-abe1-00004'
var installId5 = '5905d547-8321-4612-abe1-00005'
var installId6 = '5905d547-8321-4612-abe1-00006'
var expirationDate
var activityDate
var beckyWatchLinkId
var aliceWatchLinkId


// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var patch1Id = 'pa.010101.00000.555.000001'
var messagesPerPatch = dbProfile.mpp


var testUserTom = {
  _id :  "us.111111.11111.000.111111",
  name : "Tom",
  email : "tomtest@3meters.com",
  password : "12345678",
  photo: {
    prefix:"resource:patchholder_user",
    source:"resource",
  },
  area : "Testville, WA",
}

var testUserBob = {
  _id : "us.111111.11111.000.222222",
  name : "Bob",
  email : "bobtest@3meters.com",
  password : "12345678",
}

var testUserAlice = {
  _id : "us.111111.11111.000.333333",
  name : "Alice",
  email : "alicetest@3meters.com",
  password : "12345678",
}

var testUserBecky = {
  _id : "us.111111.11111.000.444444",
  name : "Becky",
  email : "beckytest@3meters.com",
  password : "12345678",
}

var testUserMax = {
  _id : "us.111111.11111.000.555555",
  name : "Max",
  email : "maxtest@3meters.com",
  password : "12345678",
}

var testUserStan = {
  _id : "us.111111.11111.000.666666",
  name : "Stan",
  email : "stantest@3meters.com",
  password : "12345678",
}

var testPatchPublic = {
  _id : "pa.111111.11111.111.311114",
  schema : util.statics.schemaPatch,
  name : "Hawks Nest",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  category:{
    id:"4bf58dd8d48988d18c941735",
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
  visibility: "public"
}

var testPatchPrivate = {
  _id : "pa.111111.11111.111.211112",
  schema : util.statics.schemaPatch,
  name : "Seahawks Private VIP Club",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  category:{
    id:"4bf58dd8d48988d18c941735",
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
  visibility: "private",
}

var testMessage = {
  _id : "me.111111.11111.111.222222",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "Go seahawks!",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
  _acl: testPatchPublic._id,  // Usually set by client
}

var testReply = {
  _id : "me.111111.11111.111.111112",
  schema : util.statics.schemaMessage,
  type : "reply",
  description : "Repeat! Repeat!",
  _root : "me.111111.11111.111.222222",
  _replyTo: testUserBecky._id,
  _acl: testPatchPublic._id,  // Usually set by client
}

var testMessageToPrivate = {
  _id : "me.111111.11111.111.222223",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "How do I switch views on the suite flat panel screen?",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
  _acl: testPatchPrivate._id,  // Usually set by client
}

var testReplyToPrivate = {
  _id : "me.111111.11111.111.111113",
  schema : util.statics.schemaMessage,
  type : "reply",
  description : "Use the little touch control next to the mini bar",
  _root : "me.111111.11111.111.222223",
  _replyTo: testUserBecky._id,
  _acl: testPatchPrivate._id,  // Usually set by client
}

var testBeacon = {
  _id : 'be.44:44:44:44:44:44',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '44:44:44:44:44:44',
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
  _id : 'be.55:55:55:55:55:55',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label 2',
  ssid: 'Test Beacon 2',
  bssid: '55:55:55:55:55:55',
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
        testUtil.getUserSession(testUserBecky, function(session) {
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
        registrationId: 'registration_id_testing_user_tom',
        installId: installId1,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_tom')
      t.assert(body.data[0].users.length >= 1) // Can be left over users from previous tests
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
        registrationId: 'registration_id_testing_user_bob',
        installId: installId2,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_bob')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
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
        registrationId: 'registration_id_testing_user_alice',
        installId: installId3,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_alice')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
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
        registrationId: 'registration_id_testing_user_becky',
        installId: installId4,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_becky')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
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
        registrationId: 'registration_id_testing_user_max',
        installId: installId5,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_max')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
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
        registrationId: 'registration_id_testing_user_stan',
        installId: installId6,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
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
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_stan')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
      test.done()
    })
  })
}

exports.updateBeaconsInstallOne = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCredTom,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId1
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

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
    uri: '/do/getEntitiesByProximity?' + userCredAlice,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId3
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

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
    uri: '/do/getEntitiesByProximity?' + userCredMax,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId5
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId5 }
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

exports.updateBeaconsInstallTwo = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCredBob,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId2
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

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
    uri: '/do/getEntitiesByProximity?' + userCredBecky,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId4
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

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
    uri: '/do/getEntitiesByProximity?' + userCredStan,
    body: {
      beaconIds: [testBeacon2._id],
      installId: installId6
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length >= 0)

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
 * ----------------------------------------------------------------------------
 */

exports.tomInsertsPublicPatch = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPatchPublic,    // custom patch
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    activityDate = body.data.modifiedDate  // For later checks
    /*
     * Alice and Max get notified because they are nearby.
     */
    t.assert(body.notifications.length === 1)
    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPublic._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit = true
        if (registrationId.indexOf('max') > 0 && notification.trigger == 'nearby') maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(aliceHit)
    t.assert(maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Becky and Stan should get nearby notifications.
     */
    t.assert(body.notifications.length === 1)
    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPrivate._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0 && notification.trigger == 'nearby') beckyHit = true
        if (registrationId.indexOf('stan') > 0 && notification.trigger == 'nearby') stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(beckyHit)
    t.assert(stanHit)

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
    uri: '/do/insertLink?' + userCredBob,  // owned by tom
    body: {
      toId: testPatchPublic._id,
      fromId: testUserBob._id,
      enabled: true,
      type: util.statics.typeWatch,
      actionEvent: 'watch_entity_patch',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Tom should get a watch alert because he is the patch owner.
     */
    t.assert(body.notifications.length == 1)
    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPublic._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0
          && notification.type === 'watch'
          && notification.trigger == 'own_to'
          && notification.event === 'watch_entity_patch') tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPatchPublic._id,
            event:'watch_entity_patch',
            _user: testUserBob._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.bobLikesTomsPublicPatch = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBob,  // owned by tom
    body: {
      toId: testPatchPublic._id,
      fromId: testUserBob._id,
      enabled: true,
      type: util.statics.typeLike,
      actionEvent: 'like_entity_patch',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Tom should get a like alert because he is the patch owner.
     */
    t.assert(body.notifications.length == 1)
    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPublic._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0
          && notification.type === 'like'
          && notification.trigger == 'own_to'
          && notification.event === 'like_entity_patch') tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPatchPublic._id,
            event:'like_entity_patch',
            _user: testUserBob._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.beckyRequestsToWatchBobsPrivatePatch = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBecky,
    body: {
      toId: testPatchPrivate._id,             // Owned by bob
      fromId: testUserBecky._id,
      type: util.statics.typeWatch,
      enabled: false,
      actionEvent: 'request_watch_entity',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Bob should get a request alert because he is the patch owner.
     */
    t.assert(body.notifications.length == 1)
    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPrivate._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0
          && notification.type === 'watch'
          && notification.trigger == 'own_to'
          && notification.event === 'request_watch_entity') bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPatchPrivate._id,
            event:'request_watch_entity',
            _user: testUserBecky._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}


exports.bobApprovesBeckysRequestToWatchBobsPrivatePatch = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBob,
    body: {
      linkId: beckyWatchLinkId,
      toId: testPatchPrivate._id,       // Owned by bob
      fromId: testUserBecky._id,
      type: util.statics.typeWatch,
      enabled: true,
      actionEvent: 'approve_watch_entity',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Becky should get a request alert because she is the requestor.
     */
    t.assert(body.notifications.length == 1)

    var tomHit = false
      , aliceHit = false
      , maxHit = false
      , bobHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target == testPatchPrivate._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0
          && notification.type === 'watch'
          && notification.trigger == 'own_from'
          && notification.event === 'approve_watch_entity') beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(beckyHit)
    t.assert(!stanHit)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPatchPrivate._id,
            event:'approve_watch_entity',
            _user: userCredBecky._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Add another watcher to Bobs private patch for later testing scenarios.
 * ----------------------------------------------------------------------------
 */

exports.aliceRequestsToWatchBobsPrivatePatch = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredAlice,
    body: {
      toId: testPatchPrivate._id,             // Owned by bob
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: false,
      actionEvent: 'request_watch_entity',
      returnNotifications: true,
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
    uri: '/do/insertLink?' + userCredBob,
    body: {
      linkId: aliceWatchLinkId,
      toId: testPatchPrivate._id,       // Owned by bob
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: true,
      actionEvent: 'approve_watch_entity',
      returnNotifications: true,
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
 * Seed message scenarios: Notified because:
 * - I own the patch
 *      (Tom gets notified when Becky posts message to patch)
 * - I am watching the patch
 *      (Bob gets notified when Becky or Alice post messages to patch)
 * - I am nearby the patch
 *      (Alice and Max get notified when Becky posts message to patch)
 *
 * Reply message scenarios: Notified because:
 * - I own the message being replied to
 *      (Becky gets notified when Alice replies to Becky message)
 * - I own a patch that has a message that is being replied to
 *      (Tom owns the patch and get notified about Alice's reply to Becky)
 * - I am watching a patch that has a message that is being replied to
 *      (Bob is watching the patch and is notified about Alice's reply to Becky)
 * - I am nearby a patch that has a message that is being replied to
 *      (Max is nearby and gets notified about Alice's reply to Becky)
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
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he owns the patch.
     * Bob gets notified because he is watching the patch.
     * Alice and Max get notified because they are nearby the patch.
     * Becky does not get notified because she is the sender.
     * Stan does not get notified because he isn't nearby.
     */
    t.assert(body.notifications.length === 3)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      t.assert(notification._target === testMessage._id)
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0 && notification.trigger == 'own_to') tomHit = true
        if (registrationId.indexOf('alice') > 0 && notification.trigger == 'nearby') aliceHit = true
        if (registrationId.indexOf('max') > 0 && notification.trigger == 'nearby') maxHit = true
        if (registrationId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(tomHit)
    t.assert(aliceHit)
    t.assert(maxHit)
    t.assert(bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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

exports.aliceInsertsReplyToBeckysPublicMessage = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredAlice,
    body: {
      entity: testReply,
      links: [
         { _to: testPatchPublic._id,          // Toms patch
            type: util.statics.typeContent },
         { _to: testMessage._id,              // Reply to Bobs message
            type: util.statics.typeContent }
        ],
      returnNotifications: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets notified because he owns the patch.
     * Bob gets notified because he is watching the patch.
     * Becky gets notified because she owns the message.
     * Max get notified because he is nearby the patch.
     */

    /*
     * If not run stand-alone, Alice create in previous test module
     * gets a message because she is watching tom.
     */
    t.assert(body.notifications.length === 4)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(notification) {
      notification.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0 && notification.trigger == 'own_to') tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0 && notification.trigger == 'nearby') maxHit = true
        if (registrationId.indexOf('bob') > 0 && notification.trigger == 'watch_to') bobHit = true
        if (registrationId.indexOf('becky') > 0 && notification.trigger == 'own_to') beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(tomHit)
    t.assert(!aliceHit)
    t.assert(maxHit)
    t.assert(bobHit)
    t.assert(beckyHit)
    t.assert(!stanHit)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserAlice._id)
    t.assert(savedEnt._creator === testUserAlice._id)
    t.assert(savedEnt._modifier === testUserAlice._id)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredAlice,
      body: {
        query:{ _id:testReply._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link to patch */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPatchPublic._id,
            _from: testReply._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserAlice._id)
        t.assert(link._owner === testUserTom._id)     // strong links to entites are owned by ent owner

        /* Check link to message */
        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              _to: testMessage._id,
              _from: testReply._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          t.assert(link._creator === testUserAlice._id)
          t.assert(link._owner === testUserBecky._id)     // strong links to entites are owned by ent owner

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
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Bob gets notified because he owns the patch.
     * Alice get notified as a member.
     */
    t.assert(body.notifications.length === 2)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      t.assert(message._target === testMessageToPrivate._id)
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0 && message.trigger == 'watch_to') aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0 && message.trigger == 'own_to') bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(aliceHit)
    t.assert(!maxHit)
    t.assert(bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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


exports.bobInsertsReplyToBeckysPrivateMessage = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testReplyToPrivate,
      links: [
         { _to: testPatchPrivate._id,                   // Bobs patch
            type: util.statics.typeContent },
         { _to: testMessageToPrivate._id,               // Reply to Beckys message
            type: util.statics.typeContent }
        ],
      returnNotifications: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Becky and Alice get notified because they are watching the patch.
     * Becky gets notified because she is owner of the message being replied to.
     *
     * Both notifications come through because they are separate calls.
     */

    /*
     * If not run stand-alone, Alice create in previous test module
     * gets a message because she is watching tom.
     */
    t.assert(body.notifications.length === 2)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyOwnHit = false
      , beckyWatchHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0 && message.trigger == 'watch_to') aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0 && message.trigger == 'own_to') bobHit = true
        if (registrationId.indexOf('becky') > 0 && message.trigger == 'watch_to') beckyWatchHit = true
        if (registrationId.indexOf('becky') > 0 && message.trigger == 'own_to') beckyOwnHit = true
        if (registrationId.indexOf('stan') > 0) stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(beckyOwnHit)
    t.assert(beckyWatchHit)
    t.assert(!stanHit)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBob._id)
    t.assert(savedEnt._creator === testUserBob._id)
    t.assert(savedEnt._modifier === testUserBob._id)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/find/messages?' + userCredBob,
      body: {
        query:{ _id:testReplyToPrivate._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link to patch */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPatchPrivate._id,
            _from: testReplyToPrivate._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserBob._id)
        t.assert(link._owner === testUserBob._id)     // strong links to entites are owned by ent owner

        /* Check link to message */
        t.post({
          uri: '/find/links?' + adminCred,
          body: {
            query: {
              _to: testMessageToPrivate._id,
              _from: testReplyToPrivate._id,
            }
          }
        }, function(err, res, body) {
          t.assert(body && body.data && 1 === body.data.length)
          var link = body.data[0]
          t.assert(link._creator === testUserBob._id)
          t.assert(link._owner === testUserBecky._id)     // strong links to entites are owned by ent owner

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
     * Should see two watchers (Becky and Alice)
     */
    t.assert(body.data)
    t.assert(body.count === 2)
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
      cursor: { skip: 0, limit: 50, sort: { modifiedDate: -1 }},
      links: { shortcuts: false,
         active:
          [ { schema: 'beacon', limit: 10, links: true, type: 'proximity', count: true, direction: 'both' },
            { schema: 'message', limit: 2, links: true, type: 'content', count: true, direction: 'both' }]
      },
      beaconIds: [ testBeacon._id, testBeacon2._id ]
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
        sort: { modifiedDate: -1 },
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
    t.assert(body.count === 4 || body.count === 5)
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
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    var messageDate = body.data.modifiedDate  // For later checks
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      t.assert(message._target === beckySharePatchWithStanId)
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0) tomHit = true
        if (registrationId.indexOf('alice') > 0) aliceHit = true
        if (registrationId.indexOf('max') > 0) maxHit = true
        if (registrationId.indexOf('bob') > 0) bobHit = true
        if (registrationId.indexOf('becky') > 0) beckyHit = true
        if (registrationId.indexOf('stan') > 0 && message.trigger == 'share') stanHit = true
      })
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(stanHit)

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
          t.post({
            uri: '/find/patches',
            body: {
              query:{ _id:testPatchPrivate._id }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data && body.data[0])
            t.assert(body.data[0].activityDate < messageDate)
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
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 2)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      if (!message.info) {
        t.assert(message._target === beckyShareMessageWithStanId)
        message.registrationIds.forEach(function(registrationId){
          if (registrationId.indexOf('tom') > 0) tomHit = true
          if (registrationId.indexOf('alice') > 0) aliceHit = true
          if (registrationId.indexOf('max') > 0) maxHit = true
          if (registrationId.indexOf('bob') > 0) bobHit = true
          if (registrationId.indexOf('becky') > 0) beckyHit = true
          if (registrationId.indexOf('stan') > 0 && message.trigger == 'share') stanHit = true
        })
      }
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(stanHit)

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
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 2)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      if (!message.info) {
        t.assert(message._target === beckyShareMessageWithAliceId)
        message.registrationIds.forEach(function(registrationId){
          if (registrationId.indexOf('tom') > 0) tomHit = true
          if (registrationId.indexOf('alice') > 0 && message.trigger == 'share') aliceHit = true
          if (registrationId.indexOf('max') > 0) maxHit = true
          if (registrationId.indexOf('bob') > 0) bobHit = true
          if (registrationId.indexOf('becky') > 0) beckyHit = true
          if (registrationId.indexOf('stan') > 0) stanHit = true
        })
      }
    })

    t.assert(!tomHit)
    t.assert(aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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
          source:"aircandi",
        },
      },
      links: [{
        type: 'share',
        _to: testUserStan._id,
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      if (!message.info) {
        t.assert(message._target === beckySharePhotoWithStanId)
        message.registrationIds.forEach(function(registrationId){
          if (registrationId.indexOf('tom') > 0) tomHit = true
          if (registrationId.indexOf('alice') > 0) aliceHit = true
          if (registrationId.indexOf('max') > 0) maxHit = true
          if (registrationId.indexOf('bob') > 0) bobHit = true
          if (registrationId.indexOf('becky') > 0) beckyHit = true
          if (registrationId.indexOf('stan') > 0 && message.trigger == 'share') stanHit = true
        })
      }
    })

    t.assert(!tomHit)
    t.assert(!aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(stanHit)

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
          source:"aircandi",
        },
      },
      links: [{
        type: 'share',
        _to: testUserAlice._id,
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {

    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Stan gets notified as the recipient.
     */
    t.assert(body.notifications.length === 1)

    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false
      , beckyHit = false
      , stanHit = false

    body.notifications.forEach(function(message) {
      if (!message.info) {
        t.assert(message._target === beckySharePhotoWithAliceId)
        message.registrationIds.forEach(function(registrationId){
          if (registrationId.indexOf('tom') > 0) tomHit = true
          if (registrationId.indexOf('alice') > 0 && message.trigger == 'share') aliceHit = true
          if (registrationId.indexOf('max') > 0) maxHit = true
          if (registrationId.indexOf('bob') > 0) bobHit = true
          if (registrationId.indexOf('becky') > 0) beckyHit = true
          if (registrationId.indexOf('stan') > 0) stanHit = true
        })
      }
    })

    t.assert(!tomHit)
    t.assert(aliceHit)
    t.assert(!maxHit)
    t.assert(!bobHit)
    t.assert(!beckyHit)
    t.assert(!stanHit)

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

    var patchHit = false
      , userHit = false

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserStan._id) userHit = true
      if (link.type === 'share'
          && link.targetSchema === 'patch'
          && link.shortcut
          && link.shortcut.id === testPatchPrivate._id) patchHit = true
    })

    t.assert(patchHit)
    t.assert(userHit)

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

    var userHit = false

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

    var userHit = false

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

    var messageHit = false
      , userHit = false

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserStan._id) userHit = true
      if (link.type === 'share'
          && link.targetSchema === 'message'
          && !link.shortcut) messageHit = true
    })

    t.assert(messageHit)
    t.assert(userHit)

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

    var messageHit = false
      , userHit = false

    body.data[0].linksOut.forEach(function(link) {
      if (link.type === 'share'
          && link.targetSchema === 'user'
          && link.shortcut
          && link.shortcut.id === testUserAlice._id) userHit = true
      if (link.type === 'share'
          && link.targetSchema === 'message'
          && link.shortcut
          && link.shortcut.id === testMessageToPrivate._id) messageHit = true
    })

    t.assert(userHit)
    t.assert(!messageHit)  // cannot see preview, must drill in

    // Make a second call to view the contents of the shared message to the private place
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


exports.userWatchesPatchViaRestWatchParam = function(test) {
  t.get('/find/patches/' + testPatchPublic._id + '?watch=true&' + userCredAlice,
  function(err, res, body) {
    t.assert(body.data._id === testPatchPublic._id)
    t.post({
      uri: '/find/links?' + userCredAlice,
      body: {
        query: {
          _to: testPatchPublic._id,
          _from: testUserAlice._id,
          type: 'watch',
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      var watchLink = body.data[0]

      // Now do it again
      t.get('/find/patches/' + testPatchPublic._id + '?watch=true&' + userCredAlice,
      function(err, res, body) {
        t.assert(body.data._id === testPatchPublic._id)
        t.post({
          uri: '/find/links?' + userCredAlice,
          body: {
            query: {
              _to: testPatchPublic._id,
              _from: testUserAlice._id,
              type: 'watch',
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(watchLink._id === body.data[0]._id)
          t.assert(watchLink.modifiedDate === body.data[0].modifiedDate)  // no change
          test.done()
        })
      })
    })
  })
}


exports.userWatchPatchViaRestWatchParamOnMessage = function(test) {
  t.get('/find/messages/' + testMessage._id + '?watch=true&' + userCredBecky,
  function(err, res, body) {
    t.assert(body.data._id === testMessage._id)
    t.post({
      uri: '/find/links?' + userCredBecky,
      body: {
        query: {
          _to: testPatchPublic._id,  // watch link is to the message's parent patch, not the message itself
          _from: testUserBecky._id,
          type: 'watch',
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      var watchLink = body.data[0]

      // Now do it again
      t.get('/find/messages/' + testMessage._id + '?watch=true&' + userCredBecky,
      function(err, res, body) {
        t.assert(body.data._id === testMessage._id)
        t.post({
          uri: '/find/links?' + userCredBecky,
          body: {
            query: {
              _to: testPatchPublic._id,
              _from: testUserBecky._id,
              type: 'watch',
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(watchLink._id === body.data[0]._id)
          t.assert(watchLink.modifiedDate === body.data[0].modifiedDate)  // no change
          test.done()
        })
      })
    })
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
  t.get('/find/patches/' + patch1Id + '?links[from][messages]=1&' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.links)
    t.assert(body.data.links.length = messagesPerPatch)
    t.get('/find/patches/' + patch1Id + '?links[from][messages]=1&links[limit]=2&links[skip]=2&links[sort]=_id&' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.links)
      t.assert(body.data.links.length === 2)
      t.assert(body.data.links[0].document.name === 'Message 2')  // skipped messages 0 and 1
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
      actionEvent: 'remove'
    }
  }, function(err, res, body) {
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
    uri: '/do/deleteLink?' + userCredBecky,
    body: {
      toId: testPatchPrivate._id,             // Owned by bob
      fromId: testUserBecky._id,
      type: util.statics.typeWatch,
      actionEvent: 'unwatch_entity_patch',
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPatchPrivate._id,
            event:'unwatch_entity_patch',
            _user: testUserBecky._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}


exports.formerMemberGetMessagesForPrivatePatch = function (test) {
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
     * Becky has two messages from when she was a member
     * but they should not be visible from this api path.
     */
    t.assert(body.data)
    t.assert(body.count === 0)
    test.done()
  })
}
