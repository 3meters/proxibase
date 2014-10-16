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
var adminCred
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var installId1 = '5905d547-8321-4612-abe1-00001'
var installId2 = '5905d547-8321-4612-abe1-00002'
var installId3 = '5905d547-8321-4612-abe1-00003'
var installId4 = '5905d547-8321-4612-abe1-00004'
var installId5 = '5905d547-8321-4612-abe1-00005'
var expirationDate
var activityDate


// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var place1Id = 'pl.010101.00000.555.000001'
var messagesPerPlace = dbProfile.mpp


var testUserTom = {
  _id :  "us.111111.11111.000.111111",
  name : "Tom",
  email : "tomtest@3meters.com",
  password : "12345678",
  photo: {
    prefix:"resource:placeholder_user",
    source:"resource",
  },
  area : "Testville, WA",
  enabled: true,
}

var testUserBob = {
  _id : "us.111111.11111.000.222222",
  name : "Bob",
  email : "bobtest@3meters.com",
  password : "12345678",
  enabled: true,
}

var testUserAlice = {
  _id : "us.111111.11111.000.333333",
  name : "Alice",
  email : "alicetest@3meters.com",
  password : "12345678",
  enabled: true,
}

var testUserBecky = {
  _id : "us.111111.11111.000.444444",
  name : "Becky",
  email : "beckytest@3meters.com",
  password : "12345678",
  enabled: true,
}

var testUserMax = {
  _id : "us.111111.11111.000.555555",
  name : "Max",
  email : "maxtest@3meters.com",
  password : "12345678",
  enabled: true,
}

var testPlaceCustom = {
  _id : "pl.111111.11111.111.311114",
  schema : util.statics.schemaPlace,
  name : "Hawks Nest",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  signalFence : -100,
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"4259950004",
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
}

var testPlaceCustomPrivate = {
  _id : "pl.111111.11111.111.211112",
  schema : util.statics.schemaPlace,
  name : "Seahawks Private VIP Club",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  signalFence : -100,
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550004",
  provider: {
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
  _acl: testPlaceCustom._id,  // Usually set by client
}

var testReply = {
  _id : "me.111111.11111.111.111112",
  schema : util.statics.schemaMessage,
  type : "reply",
  description : "Repeat! Repeat!",
  _root : "me.111111.11111.111.222222",
  _replyTo: testUserBecky._id,
  _acl: testPlaceCustom._id,  // Usually set by client
}

var testBeacon = {
  _id : 'be.11:11:11:11:11:11',
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
  _id : 'be.22:22:22:22:22:22',
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
            testUtil.getAdminSession(function(session) {
              adminCred = 'user=' + session._owner + '&session=' + session.key
              test.done()
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

/*
 * ----------------------------------------------------------------------------
 * Messages
 * ----------------------------------------------------------------------------
 */

exports.insertCustomPlaceMessages = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPlaceCustom,    // custom place
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
    var aliceHit = false, maxHit = false

    body.notifications.forEach(function(message) {
      t.assert(message._target == testPlaceCustom._id)
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('alice') > 0 && message.trigger == 'nearby') aliceHit = true
        if (registrationId.indexOf('max') > 0 && message.trigger == 'nearby') maxHit = true
      })
    })

    t.assert(aliceHit)
    t.assert(maxHit)

    test.done()
  })
}

exports.insertPlaceCustomPrivate = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testPlaceCustomPrivate,
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom, Alice and Max should get a nearby message since tom is registered
     * with beacons that intersect the ones for custom place 2.
     * Bob should get a message because he is the source.
     */
    t.assert(body.notifications.length === 1)
    var aliceHit = false
      , maxHit = false
      , tomHit = false

    body.notifications.forEach(function(message) {
      t.assert(message._target == testPlaceCustomPrivate._id)
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0 && message.trigger == 'nearby') tomHit = true
        if (registrationId.indexOf('alice') > 0 && message.trigger == 'nearby') aliceHit = true
        if (registrationId.indexOf('max') > 0 && message.trigger == 'nearby') maxHit = true
      })
    })

    t.assert(tomHit)
    t.assert(aliceHit)
    t.assert(maxHit)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBob._id)
    t.assert(savedEnt._creator === testUserBob._id)
    t.assert(savedEnt._modifier === testUserBob._id)

    /* Check insert place custom */
    t.post({
      uri: '/find/places',
      body: {
        query:{ _id:testPlaceCustomPrivate._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check beacon link count */
      t.post({
        uri: '/find/links',
        body: {
          query: { _to:testBeacon._id }
        }
      }, function(err, res, body) {
        /* Will fail if run stand-alone */
        t.assert(body.count === 3)
        test.done()
      })
    })
  })
}

exports.watchPublicPlace = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBob,  // owned by tom
    body: {
      toId: testPlaceCustom._id,
      fromId: testUserBob._id,
      enabled: true,
      type: util.statics.typeWatch,
      actionEvent: 'watch_entity_place',
      returnNotifications: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Tom should get a watch alert because he is the place owner.
     */
    t.assert(body.notifications.length == 1)
    t.assert(body.notifications[0].type === 'alert')
    t.assert(body.notifications[0].trigger === 'own_to')

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPlaceCustom._id,
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
            _entity:testPlaceCustom._id,
            event:'watch_entity_place',
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

exports.watchPrivatePlaceRequest = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredAlice,  // owned by bob
    body: {
      toId: testPlaceCustomPrivate._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: false,
      actionEvent: 'request_watch_entity',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Bob should get a request alert because he is the place owner.
     */
    t.assert(body.notifications.length == 1)
    t.assert(body.notifications[0].type === 'alert')
    t.assert(body.notifications[0].trigger === 'own_to')

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPlaceCustomPrivate._id,
          _from: testUserAlice._id,
          type: util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data[0].enabled === false)
      watchLinkId = body.data[0]._id

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPlaceCustomPrivate._id,
            event:'request_watch_entity',
            _user: testUserAlice._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.watchPrivatePlaceApprove = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBob,  // owned by bob
    body: {
      linkId: watchLinkId,
      toId: testPlaceCustomPrivate._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: true,
      actionEvent: 'approve_watch_entity',
      returnNotifications: true,
      log: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Alice should get a request alert because she is the requestor.
     */
    t.assert(body.notifications.length == 1)
    t.assert(body.notifications[0].type === 'alert')
    t.assert(body.notifications[0].trigger === 'own_from')

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPlaceCustomPrivate._id,
          _from: testUserAlice._id,
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
            _entity:testPlaceCustomPrivate._id,
            event:'approve_watch_entity',
            _user: userCredBob._id,
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
 *
 * Users
 * - Tom, Alice and Max are all near each other
 * - Bob and Becky are far away
 * - Tom owns the patch
 * - Bob is watching the patch and is far away
 * - Alice and Max are nearby the patch
 *
 * Seed message scenarios: Notified because:
 * - I own the patch
 *      (Tom gets notified when Becky posts message to patch)
 * - I am watching the patch
 *      (Bob gets notified when Becky posts message to patch)
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

exports.insertMessage = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBecky,
    body: {
      entity: testMessage,
      links: [{
        _to: testPlaceCustom._id,     // Toms place
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
     */
    t.assert(body.notifications.length === 3)
    var tomHit = false
      , bobHit = false
      , aliceHit = false
      , maxHit = false

    body.notifications.forEach(function(message) {
      t.assert(message._target === testMessage._id)
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0 && message.trigger == 'own_to') tomHit = true
        if (registrationId.indexOf('bob') > 0 && message.trigger == 'watch_to') bobHit = true
        if (registrationId.indexOf('alice') > 0 && message.trigger == 'nearby') aliceHit = true
        if (registrationId.indexOf('max') > 0 && message.trigger == 'nearby') maxHit = true
      })
    })
    t.assert(tomHit)
    t.assert(bobHit)
    t.assert(aliceHit)
    t.assert(maxHit)

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
      t.assert(body.data[0]._acl === testPlaceCustom._id)

      /* Check link */
      t.post({
        uri: '/find/links?' + adminCred,
        body: {
          query: {
            _to: testPlaceCustom._id,
            _from: testMessage._id,
          }
        }
      }, function(err, res, body) {
        t.assert(body && body.data && 1 === body.data.length)
        var link = body.data[0]
        t.assert(link._creator === testUserBecky._id)
        t.assert(link._owner === testUserTom._id)  // strong links to entites are owned by ent owner

        /* Check activityDate for place */
        t.post({
          uri: '/find/places',
          body: {
            query:{ _id:testPlaceCustom._id }
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

exports.insertReply = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredAlice,
    body: {
      entity: testReply,
      links: [
         { _to: testPlaceCustom._id,          // Toms place
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
     * Alice does not get notified because she is the sender.
     */

    /*
     * If not run stand-alone, Alice create in previous test module
     * gets a message because she is watching tom.
     */
    t.assert(body.notifications.length === 4)
    var tomHit = false
      , bobHit = false
      , beckyHit = false
      , maxHit = false

    body.notifications.forEach(function(message) {
      message.registrationIds.forEach(function(registrationId){
        if (registrationId.indexOf('tom') > 0 && message.trigger == 'own_to') tomHit = true
        if (registrationId.indexOf('bob') > 0 && message.trigger == 'watch_to') bobHit = true
        if (registrationId.indexOf('becky') > 0 && message.trigger == 'own_to') beckyHit = true
        if (registrationId.indexOf('max') > 0 && message.trigger == 'nearby') maxHit = true
      })
    })
    t.assert(tomHit)
    t.assert(bobHit)
    t.assert(beckyHit)
    t.assert(maxHit)

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
            _to: testPlaceCustom._id,
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

          /* Check activityDate for place */
          t.post({
            uri: '/find/places',
            body: {
              query:{ _id:testPlaceCustom._id }
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

exports.previewMessagesByProximity = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCredBob,
    body: {
      cursor: { skip: 0, limit: 50, sort: { modifiedDate: -1 }},
      links: { shortcuts: false,
         active:
          [ { schema: 'beacon',
              limit: 10,
              links: true,
              type: 'proximity',
              count: true,
              direction: 'both' },
            { schema: 'message',
              limit: 2,
              links: true,
              type: 'content',
              count: true,
              direction: 'both' }]
      },
      beaconIds: [ testBeacon._id ]
    }
  },

  function(err, res, body) {
    t.assert(body.data && body.data.length >= 2)
    /*
     * Includes one private and one public place.
     * Counts are available but not message content for either.
     */
    var privatePlace = body.data[0]
    t.assert(privatePlace._id === testPlaceCustomPrivate._id)
    t.assert(!privatePlace.linksIn)
    t.assert(!privatePlace.linksOut)
    t.assert(privatePlace.linksOutCounts[0].schema === 'beacon')
    t.assert(privatePlace.linksOutCounts[0].count === 1)

    var publicPlace = body.data[1]
    t.assert(!publicPlace.linksIn)
    t.assert(!publicPlace.linksOut)
    t.assert(publicPlace.linksInCounts && publicPlace.linksInCounts.length === 1)
    t.assert(publicPlace.linksInCounts[0].schema === 'message')
    t.assert(publicPlace.linksInCounts[0].count === 2)
    t.assert(publicPlace.linksOutCounts && publicPlace.linksOutCounts.length === 1)
    t.assert(publicPlace.linksOutCounts[0].schema === 'beacon')
    t.assert(publicPlace.linksOutCounts[0].count === 1)
    test.done()
  })
}


/*
 * ----------------------------------------------------------------------------
 * Alerts feed
 * ----------------------------------------------------------------------------
 */

exports.getAlertsForSelf = function (test) {
  t.post({
    uri: '/do/getAlerts?' + userCredTom,
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
    // Should see Bob watching Tom's place
    // Note: this test file does not stand on it's own because
    // an earlier test file is creating another watch.
    t.assert(body.data)
    t.assert(body.count === 1 || body.count === 2)
    test.done()
  })
}

/*
 * ----------------------------------------------------------------------------
 * Message feed
 * ----------------------------------------------------------------------------
 */

exports.getMessagesForSelf = function (test) {
  t.post({
    uri: '/do/getMessages?' + userCredTom,
    body: {
      entityId: testUserTom._id,
      cursor: {
        limit: 50,
        linkTypes: ['create', 'watch'],
        schemas: ['place', 'user'],
        skip: 0,
        sort: { modifiedDate: -1 },
      },
      links : {
        shortcuts: true,
        active:
        [ { schema: 'place',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'both' },
          { schema: 'place',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'user',
            limit: 5,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' } ]
      }
    }
  },

  function(err, res, body) {
    // Should see bobs message and alices reply
    // Note: this test file does not stand on it's own because
    // an earlier test file is creating a message for Tom.
    t.assert(body.data)
    t.assert(body.count === 2 || body.count === 3)
    test.done()
  })
}

exports.getMessage = function (test) {
  t.post({
    uri: '/do/getEntities?' + userCredTom,
    body: {
      entityIds: [testMessage._id],
      links : {
        shortcuts: true,
        active:
        [ { schema: 'place',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'both' },
          { schema: 'place',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'user',
            limit: 5,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' } ]
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
        [ { schema: 'place',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'content',
            count: true,
            direction: 'both' },
          { schema: 'place',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'message',
            limit: 1,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
          { schema: 'user',
            limit: 5,
            links: true,
            type: 'share',
            count: true,
            direction: 'out' } ]
      }
    }
  },

  function(err, res, body) {
    // Should not see alices reply message from above
    t.assert(body.data)
    // George changed.  I think it is ok to see her messages to public places
    // t.assert(body.count === 0)
    t.assert(body.count === 1)
    test.done()
  })
}


exports.userWatchesPlaceViaRestWatchParam = function(test) {
  t.get('/find/places/' + testPlaceCustom._id + '?watch=true&' + userCredAlice,
  function(err, res, body) {
    t.assert(body.data._id === testPlaceCustom._id)
    t.post({
      uri: '/find/links?' + userCredAlice,
      body: {
        query: {
          _to: testPlaceCustom._id,
          _from: testUserAlice._id,
          type: 'watch',
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      var watchLink = body.data[0]

      // Now do it again
      t.get('/find/places/' + testPlaceCustom._id + '?watch=true&' + userCredAlice,
      function(err, res, body) {
        t.assert(body.data._id === testPlaceCustom._id)
        t.post({
          uri: '/find/links?' + userCredAlice,
          body: {
            query: {
              _to: testPlaceCustom._id,
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


exports.userWatchPlaceViaRestWatchParamOnMessage = function(test) {
  t.get('/find/messages/' + testMessage._id + '?watch=true&' + userCredBecky,
  function(err, res, body) {
    t.assert(body.data._id === testMessage._id)
    t.post({
      uri: '/find/links?' + userCredBecky,
      body: {
        query: {
          _to: testPlaceCustom._id,  // watch link is to the message's parent place, not the message itself
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
              _to: testPlaceCustom._id,
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
  t.get('/find/places/' + place1Id + '?links[from][messages]=1&' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.links)
    t.assert(body.data.links.length = messagesPerPlace)
    t.get('/find/places/' + place1Id + '?links[from][messages]=1&links[limit]=2&links[skip]=2&links[sort]=_id&' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.links)
      t.assert(body.data.links.from)
      t.assert(body.data.links.from.messages)
      t.assert(body.data.links.from.messages.length === 2)
      t.assert(body.data.links.from.messages[0].document.name === 'Message 2')  // skipped messages 0 and 1
      test.done()
    })
  })
}


exports.removeMessageFromPlace = function(test) {
  t.post({
    uri: '/do/removeLinks?' + userCredTom,  // place owner
    body: {
      toId: testPlaceCustom._id,
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
          _to:testPlaceCustom._id,
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
