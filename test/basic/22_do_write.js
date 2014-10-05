/**
 *  Proxibase custom methods test
 */

var util = require('proxutils')
var log = util.log
var adminId = util.adminUser._id
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCredTom
var userCredBob
var userCredAlice
var adminCred
var trackingLink
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var testLatitude2 = 47.1
var testLongitude2 = -122.1
var radiusTiny = 0.000001
var radiusBig = 10000
var installId1 = '5905d547-8321-4612-abe1-00001'
var installId2 = '5905d547-8321-4612-abe1-00002'
var installId3 = '5905d547-8321-4612-abe1-00003'
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
var testPlaceOne = {
  _id : "pl.111111.11111.111.111111",
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
var testPlaceTwo = {
  _id : "pl.111111.11111.111.111112",
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
var testPlaceCustomPublic = {
  _id : "pl.111111.11111.111.211111",
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
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550003",
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
  visibility: "public",
}
var testPlaceCustomPrivate = {
  _id : "pl.111111.11111.111.211112",
  schema : util.statics.schemaPlace,
  name : "Testing place entity custom two",
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
var testPlaceCustomLocked = {
  _id : "pl.111111.11111.111.211113",
  schema : util.statics.schemaPlace,
  name : "Testing place entity custom locked",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  signalFence : -100,
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  provider: {
    aircandi: 'aircandi',
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"2065550005",
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
  _id : "po.111111.11111.111.111111",
  schema : util.statics.schemaPost,
  name : "Testing post entity",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
}
var testComment = {
  _id : "co.111111.11111.111.111111",
  schema : util.statics.schemaComment,
  name : "Test comment",
  description : "Test comment, much ado about nothing.",
}
var testComment2 = {
  _id : "co.111111.11111.111.111112",
  schema : util.statics.schemaComment,
  name : "Test comment for locked entity",
  description : "Test comment, much ado about nothing.",
}
var testComment3 = {
  _id : "co.111111.11111.111.111113",
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
  origin: "facebook",
  validatedDate: 1369167109174.0,
  popularity: 100
}
var testApplink2 = {
  schema: util.statics.schemaApplink,
  name: "Applink New",
  photo: {
    prefix:"https://graph.facebook.com/143970268959049/picture?type=large",
    source:"facebook",
  },
  appId: "143970268959049",
  origin: "facebook",
  validatedDate: 1369167109174.0,
  popularity: 100,
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
var testBeacon3 = {
  _id : 'be.33:33:33:33:33:33',
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
  _from : 'pl.111111.11111.111.111111',
  type: 'proximity',
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
  testUtil.getUserSession(testUserTom, function(session) {
    userCredTom = 'user=' + session._owner + '&session=' + session.key
    testUtil.getUserSession(testUserBob, function(session) {
      userCredBob = 'user=' + session._owner + '&session=' + session.key
      testUtil.getUserSession(testUserAlice, function(session) {
        userCredAlice = 'user=' + session._owner + '&session=' + session.key
        testUtil.getAdminSession(function(session) {
          adminCred = 'user=' + session._owner + '&session=' + session.key
          test.done()
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
    uri: '/do/registerInstall?' + userCredBob,
    body: {
      install: {
        registrationId: 'registration_id_testing_user_bob',
        installId: installId1,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('registered') > 0)

    /* Check register install */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId1 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert('in.' + installId1 == body.data[0]._id)  // proves custom genId works
      t.assert(body.data[0].installId)
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_bob')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
      test.done()
    })
  })
}

exports.registerSecondUserOnInstallOne = function (test) {
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
    t.assert(body.info.indexOf('registration updated') > 0)

    /* Check registger install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId1 }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installId)
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].registrationId === 'registration_id_testing_user_tom')
      t.assert(body.data[0].users.length === 2)
      test.done()
    })
  })
}

exports.registerInstallTwo = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCredBob,
    body: {
      install: {
        registrationId: 'registration_id_testing_user_bob',
        installId: installId2,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('registered') > 0)

    /* Check register install second user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId2 }
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
        registrationId: 'registration_id_testing_user_alice',
        installId: installId3,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('registered') > 0)

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

exports.updateBeaconsInstallOne = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCredTom,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId1
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length == 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId1 }
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
      beaconIds: [testBeacon._id],
      installId: installId2
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length == 0)

    /* Check install beacons */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query: { installId: installId2 }
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
      beaconIds: [testBeacon2._id],
      installId: installId3
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length == 0)

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

/*
 * ----------------------------------------------------------------------------
 * Insert places
 * ----------------------------------------------------------------------------
 */

// Test removed becasue now you can, see test 50
_exports.cannotInsertEntityNotLoggedIn = function (test) {
  t.post({
    uri: '/do/insertEntity',
    body: {
      entity:testPlaceOne,
      beacons:[testBeacon],
      primaryBeaconId:testBeacon._id,
    }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.insertPlaceOne = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPlaceOne,
      returnMessages: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length == 0) // Messaging isn't called because place is synthetic

    var savedEnt = body.data
    t.assert(savedEnt._owner === util.adminUser._id)
    t.assert(savedEnt._creator === testUserTom._id)
    t.assert(savedEnt._modifier === testUserTom._id)

    /* Check insert place */
    t.post({
      uri: '/find/places',
      body: {
        query: { _id: testPlaceOne._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /*
       * Check did not insert 'create' link. Create link requires
       * that user is both owner and creator.
       */
      t.post({
        uri: '/find/links',
        body: {
          query: {
            _from: testUserTom._id,
            _to: testPlaceOne._id,
            type: 'create',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check inserted action */
        t.post({
          uri: '/find/actions?' + adminCred,
          body: {
            query: { _entity:testPlaceOne._id, event:'insert_entity_place'}
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          test.done()
        })
      })
    })
  })
}

exports.insertPlaceCustomPublic = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPlaceCustomPublic,
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Bob should get a nearby message since bob is registered
     * with beacons that intersect the ones for custom place 1. Tom should
     * not get a message because he is the source.
     */
    t.assert(body.messages.length == 1) // Messaging is called
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(!body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)
    t.assert(body.messages[0].trigger == 'nearby')

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserTom._id)
    t.assert(savedEnt._creator === testUserTom._id)
    t.assert(savedEnt._modifier === testUserTom._id)

    /* Check insert place custom */
    t.post({
      uri: '/find/places',
      body: {
        query: { _id:testPlaceCustomPublic._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check inserted beacon */
      t.post({
        uri: '/find/beacons',
        body: {
          query: { _id:testBeacon._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data[0]._owner === util.adminUser._id)  // Beacons should be owned by admin
        t.assert(body.data[0]._creator === testUserTom._id)      // Creator and modifier should be user who first added them
        t.assert(body.data[0]._modifier === testUserTom._id)

        /* Check inserted beacon link, store the link */
        t.post({
          uri: '/find/links',
          body: {
            query:{
              _to:testBeacon._id,
              _from:testPlaceCustomPublic._id,
              'proximity.primary':true
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)

          /* Check insert 'create' link */
          t.post({
            uri: '/find/links',
            body: {
              query:{
                _from: testUserTom._id,
                _to: testPlaceCustomPublic._id,
                type: 'create',
              }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)

            /* Check inserted action */
            t.post({
              uri: '/find/actions?' + adminCred,
              body: {
                query: { _entity:testPlaceCustomPublic._id, event:'insert_entity_place'}
              }
            }, function(err, res, body) {
              t.assert(body.count === 1)
              test.done()
            })
          })
        })
      })
    })
  })
}

exports.insertPlaceCustomLockedWithNoLinks = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPlaceCustomLocked,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    /*
     * Message is generated because this is a custom place but should not be any valid triggers.
     */
    t.assert(body.messages.length == 1)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(!body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)
    t.assert(body.messages[0].info.indexOf('no triggers') >= 0)

    /* Check insert entity no links */
    t.post({
      uri: '/find/places',
      body: {
        query:{_id:testPlaceCustomLocked._id}
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      var ent = body.data[0]
      t.assert(ent.location.lat && ent.location.lng)
      t.assert(ent.location.geometry)
      t.assert(ent._owner === testUserTom._id)
      t.assert(ent._creator === testUserTom._id)
      t.assert(ent._modifier === testUserTom._id)
      t.assert(ent.createdDate === ent.modifiedDate)
      test.done()
    })
  })
}

exports.insertPlaceCustomPrivate = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testPlaceCustomPrivate,
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom should get a nearby message since tom is registered
     * with beacons that intersect the ones for custom place 2. Bob should
     * not get a message because he is the source.
     */
    t.assert(body.messages.length == 1) // Messaging is called
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(!body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)
    t.assert(body.messages[0].trigger == 'nearby')

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
        t.assert(body.count === 2)
        test.done()
      })
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Like and unlike, watch, request/approve
 * ----------------------------------------------------------------------------
 */

exports.likeEntity = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredBob,
    body: {
      toId: testPlaceCustomPublic._id,
      fromId: testUserBob._id,
      type: util.statics.typeLike,
      actionEvent: 'like'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check like entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to:testPlaceCustomPublic._id,
          _from:testUserBob._id,
          type: util.statics.typeLike
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{ _entity:testPlaceCustomPublic._id, event:'like'}
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.unlikeEntity = function(test) {
  t.post({
    uri: '/do/deleteLink?' + userCredBob,
    body: {
      toId: testPlaceCustomPublic._id,
      fromId: testUserBob._id,
      type: util.statics.typeLike,
      actionEvent: 'unlike'
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('successful') > 0)

    /* Check unlike entity */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _to:testPlaceCustomPublic._id,
          _from:testUserBob._id,
          type:util.statics.typeLike
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

exports.watchPublicPlace = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredAlice,  // owned by tom
    body: {
      toId: testPlaceCustomPublic._id,
      fromId: testUserAlice._id,
      enabled: true,
      type: util.statics.typeWatch,
      actionEvent: 'watch'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query: {
          _to: testPlaceCustomPublic._id,
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
            _entity:testPlaceCustomPublic._id,
            event:'watch',
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

exports.watchPrivatePlaceRequest = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredAlice,  // owned by bob
    body: {
      toId: testPlaceCustomPrivate._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: false,
      actionEvent: 'watch_requested'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

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

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testPlaceCustomPrivate._id,
            event:'watch_requested',
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
    uri: '/do/enableLink?' + userCredBob,  // owned by bob
    body: {
      toId: testPlaceCustomPrivate._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: true,
      actionEvent: 'watch_approved'
    }
  }, 200, function(err, res, body) {
    t.assert(body.count === 1)

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
            event:'watch_approved',
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

exports.watchUser = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCredAlice,
    body: {
      toId: testUserTom._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      enabled: true,
      actionEvent: 'watch'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check watch entity link to entity 2 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _to: testUserTom._id,
          _from: testUserAlice._id,
          type: util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link entity log action */
      t.post({
        uri: '/find/actions?' + adminCred,
        body: {
          query:{
            _entity:testUserTom._id,
            event:'watch',
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

/*
 * ----------------------------------------------------------------------------
 * Track and untrack
 * ----------------------------------------------------------------------------
 */

exports.trackEntityProximity = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCredTom,
    body: {
      entityId:testPlaceOne._id,
      beacons:[testBeacon, testBeacon2, testBeacon3],
      primaryBeaconId:testBeacon2._id,
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)

    /* Check track entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPlaceOne._id,
          type:util.statics.typeProximity
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Check track entity proximity link from entity 1 to beacon 2 */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            _to:testBeacon2._id,
            _from:testPlaceOne._id,
            type:util.statics.typeProximity
          }
        }
      }, function(err, res, body) {
        trackingLink = body.data[0]
        t.assert(body.count === 1)
        t.assert(body.data[0].proximity.primary === true)
        t.assert(body.data[0].proximity.signal === testBeacon2.signal)

        /* Check track entity log action */
        t.post({
          uri: '/find/actions?' + adminCred,
          body: {
            query:{
              _entity:trackingLink._id,
              event:'link_proximity'
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          test.done()
        })
      })
    })
  })
}

exports.untrackEntityProximity = function(test) {
  t.post({
    uri: '/do/untrackEntity?' + userCredTom,
    body: {
      entityId:testPlaceOne._id,
      beacons:[testBeacon, testBeacon2, testBeacon3],
      actionEvent:'proximity_minus',
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('untracked') > 0)

    /* Check untrack entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPlaceOne._id,
          type:util.statics.typeProximity
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

exports.trackEntityProximityAgain = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCredTom,
    body: {
      entityId:testPlaceOne._id,
      beacons:[testBeacon, testBeacon2, testBeacon3],
      primaryBeaconId:testBeacon2._id,
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)

    /* Check track entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPlaceOne._id,
          type:util.statics.typeProximity
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Check track entity proximity link from entity 1 to beacon 2 */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            _to:testBeacon2._id,
            _from:testPlaceOne._id,
            type:util.statics.typeProximity
          }
        }
      }, function(err, res, body) {
        trackingLink = body.data[0]
        t.assert(body.count === 1)
        t.assert(body.data[0].proximity.primary === true)
        t.assert(body.data[0].proximity.signal === testBeacon2.signal)

        /* Check track entity log action */
        t.post({
          uri: '/find/actions?' + adminCred,
          body: {
            query:{
              _entity:trackingLink._id,
              event:'link_proximity'
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          test.done()
        })
      })
    })
  })
}

exports.untrackEntityProximityWipeAll = function(test) {
  t.post({
    uri: '/do/untrackEntity?' + userCredTom,
    body: {
      entityId:testPlaceOne._id,
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('untracked') > 0)

    /* Check untrack entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPlaceOne._id,
          type:util.statics.typeProximity
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

exports.trackEntityNoBeacons = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCredTom,
    body: {
      entityId:testPlaceOne._id,
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)

    /* Check track entity no beacons log action */
    t.post({
      uri: '/find/actions?' + adminCred,
      body: {
        query:{
          _entity:testPlaceOne._id,
          event:'entity_proximity'
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Update beacon location
 * ----------------------------------------------------------------------------
 */

exports.updateBeaconLocationUsingNewLocation = function (test) {
  t.post({
    uri: '/do/updateBeaconLocation?' + userCredTom,
    body: {
      beaconIds: [testBeacon._id],
      beaconSignals: [-79],
      location: testLocation2
    }
  }, function(err, res, body) {
    setTimeout(function() {
      // beacon observation update is fire-and-forget, give time to finish

      /* Check beacon location update */
      t.post({
        uri: '/find/beacons',
        body: {
          query:{ _id:testBeacon._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data[0].location.lat === 47.1)
        t.assert(body.data[0].location.lng === -122.1)
        t.assert(body.data[0].signal === -79)
        test.done()
      })
    }, 200)
  })
}

/*
 * ----------------------------------------------------------------------------
 * Permissions
 * ----------------------------------------------------------------------------
 */

exports.cannotDeleteEntityWhenNotSignedIn = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.userCannotDeleteBeaconEntitySheCreated = function (test) {
  t.del({
    uri: '/data/beacons/' + testBeacon._id + '?' + userCredTom
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

/*
 * ----------------------------------------------------------------------------
 * Insert, update, delete posts and comments
 * ----------------------------------------------------------------------------
 */

exports.insertPost = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testPost,
      links: [{
        _to: testPlaceCustomPublic._id,
        type: util.statics.typeContent,
      }],
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    /* Check inserted post */
    t.post({
      uri: '/find/posts',
      body: {
        query: { _id: testPost._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])

      /* Check content link for post */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            _from: testPost._id,
            _to: testPlaceCustomPublic._id,
            type: 'content',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])

        /* Check create link for post */
        t.post({
          uri: '/find/links',
          body: {
            query:{
              _from: testUserBob._id,
              _to: testPost._id,
              type: 'create',
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          test.done()
        })
      })
    })
  })
}

exports.insertComment = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testComment,
      links: [{
        _to: testPost._id,
        type: util.statics.typeContent,
      }],
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    /* Check insert */
    t.post({
      uri: '/find/comments',
      body: {
        query: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])

      /* Check content link for comment */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            _from: testComment._id,
            _to: testPost._id,
            type: 'content',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])

        /* Check create link for comment */
        t.post({
          uri: '/find/links',
          body: {
            query:{
              _from: testUserTom._id,
              _to: testComment._id,
              type: 'create',
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          test.done()
        })
      })
    })
  })
}

exports.insertLink = function (test) {
  t.post({
    uri: '/data/links?' + userCredTom,
    body: {data:testLink}
  }, 201, function(err, res, body) {
    t.assert(body.count === 1 && body.data)
    testLink._id = body.data._id

    /* Check inserted link */
    t.get({
      uri: '/data/links/' + testLink._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data._id === testLink._id)
      test.done()
    })
  })
}

exports.deletePost = function (test) {
  /*
  t.post({
    uri: '/do/deleteEntity?' + adminCred,
    body: {
      entityId:testPost._id,
      verbose: true,
    }
  */
  t.del({
    uri: '/data/posts/' + testPost._id + '?' + adminCred
  }, function(err, res, body) {
    t.assert(body.count === 1)
    // t.assert(body.data && body.data._id)

    /* Check delete post */
    t.post({
      uri: '/find/posts',
      body: {
        query:{
          _id:testPost._id
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check delete all links to/from post */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            $or: [
              { _to:testPost._id },
              { _from:testPost._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check delete comment link*/
        t.post({
          uri: '/find/links',
          body: {
            query:{
              _id:testComment._id
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 0)

          /* Check delete all content links to/from comment */
          t.post({
            uri: '/find/links',
            body: {
              query:{
                $or: [
                  { _to:testComment._id },
                  { _from:testComment._id },
                ]
              }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data[0].fromSchema === 'user')
            t.assert(body.data[0].type === 'create')

            /* Check delete post entity log actions */
            t.post({
              uri: '/find/actions?' + adminCred,
              body: {
                query:{
                  $and: [
                    { event: { $ne: 'delete_entity_post' }},
                    { $or: [
                      { _entity: testPost._id },
                      { _toEntity: testPost._id },
                    ]},
                  ]
                }
              }
            }, function(err, res, body) {
              t.assert(body.count === 0)

              /* Check that comment log actions were not deleted */
              t.post({
                uri: '/find/actions?' + adminCred,
                body: {
                  query:{
                    $or: [
                      { _entity: testComment._id },
                      { _toEntity: testComment._id },
                    ]
                  }
                }
              }, function(err, res, body) {
                t.assert(body.count !== 0)
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
 * Update and delete places
 * ----------------------------------------------------------------------------
 */

exports.updatePlaceOwnedByAdmin= function (test) {
  testPlaceOne.name = 'This change will fail silently'
  testPlaceOne.photo = {prefix: 'newPhoto.jpg'}
  t.post({
    uri: '/do/updateEntity?' + userCredTom,
    body: {
      entity:testPlaceOne
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check update entity */
    t.get({
      uri: '/data/places/' + testPlaceOne._id
    }, function(err, res, body) {
      var place = body.data
      t.assert(place)
      t.assert(place.photo && place.photo.prefix === 'newPhoto.jpg')
      t.assert(testUserTom._id === place._modifier)
      t.assert(place.name === 'Testing place entity')  // update failed silently
      test.done()
    })
  })
}

exports.userCantDeleteEntityTheyDontOwn = function (test) {
  t.del({
    uri: '/data/places/' + testPlaceOne._id + '?' + userCredTom
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.deletePlace = function (test) {
  t.del({
    uri: '/data/places/' + testPlaceOne._id + '?' + adminCred
  }, function(err, res, body) {
    t.assert(body.count === 1)
    // t.assert(body.data && body.data._id)

    /* Check delete entity */
    t.post({
      uri: '/find/places',
      body: {
        query:{
          _id:testPlaceOne._id
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check delete all links from/to place */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            $or: [
              { _to: testPlaceOne._id },
              { _from: testPlaceOne._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check delete entity log actions */
        t.post({
          uri: '/find/actions?' + adminCred,
          body: {
            query:{
              $and: [
                { event: { $ne: 'delete_entity_place' }},
                { $or: [
                  { _entity: testPlaceOne._id },
                  { _toEntity: testPlaceOne._id },
                ]},
              ]
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 0)
            test.done()
        })
      })
    })
  })
}

exports.nonOwnerCannotCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testComment2,
      links: [{
        _to: testPlaceCustomLocked._id,
        type: util.statics.typeContent
      }],
    }
  }, 401, function(err, res, body) {
    t.assert(body.error && body.error.code === 401.6)
    test.done()
  })
}

exports.ownerCanCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testComment2,
      links: [{
        _to: testPlaceCustomLocked._id,
        type: util.statics.typeContent
      }],
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    /* Check owner inserted comment on locked record */
    t.post({
      uri: '/find/comments',
      body: {
        query:{ _id:testComment2._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}

exports.adminCanCommentOnLockedRecord = function(test) {
  t.post({
    uri: '/do/insertEntity?' + adminCred,
    body: {
      entity: testComment3,
      links: [{
        _to: testPlaceCustomLocked._id,
        type: util.statics.typeContent
      }],
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    /* Check admin inserted comment on locked record */
    t.post({
      uri: '/find/comments',
      body: {
        query:{ _id:testComment3._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}

exports.nonOwnerCannotUpdateLockedRecord = function(test) {
  testPlaceCustomLocked.name = 'Testing non owner update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + userCredBob,
    body: {
      entity:testPlaceCustomLocked
    }
  }, 401, function(err, res, body) {
    t.assert(body.error && body.error.code === 401.6)
    test.done()
  })
}

exports.ownerCanUpdateLockedRecord = function(test) {
  testPlaceCustomLocked.name = 'Testing owner update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + userCredTom,
    body: {
      entity:testPlaceCustomLocked
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check owner updated locked record */
    t.get({
      uri: '/data/places/' + testPlaceCustomLocked._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name.indexOf('update') >= 0)
      test.done()
    })
  })
}

exports.adminCanUpdateLockedRecord = function(test) {
  testPlaceCustomLocked.name = 'Testing admin update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + adminCred,
    body: {
      entity:testPlaceCustomLocked
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check admin updated locked record */
    t.get({
      uri: '/data/places/' + testPlaceCustomLocked._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name.indexOf('update') >= 0)
      test.done()
    })
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
