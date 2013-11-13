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
  _id :  "us.111111.11111.111.111111",
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
  _id : "us.111111.11111.111.222222",
  name : "John Q Test2",
  email : "johnqtest2@3meters.com",
  password : "12345678",
  enabled: true,
}
var testPlace = {
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
var testPlace2 = {
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
var testPlace3 = {
  _id : "pl.111111.11111.111.111113",
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
  _id : "pl.111111.11111.111.111114",
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
  _id : "po.111111.11111.111.111111",
  schema : util.statics.schemaPost,
  name : "Testing post entity",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
}
var testCandigramBounce = {
  _id : "ca.111111.11111.111.111111",
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
  _id : "ca.111111.11111.111.222222",
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

exports.registerInstall = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCred,
    body: {
      install: {
        _id: constants.installId,
        _user: testUser._id,
        registrationId: constants.registrationId,
        installationId: constants.installationId,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('registered') > 0)

    /* Check register install */
    t.post({
      uri: '/do/find',
      body: {
        collection:'installs',
        find:{ _id:constants.installId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installationId)
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
      test.done()
    })
  })
}

exports.registerInstallSecondUser = function (test) {
  t.post({
    uri: '/do/registerInstall?' + userCred,
    body: {
      install: {
        _id: constants.installId,
        _user: testUser2._id,
        registrationId: constants.registrationId,
        installationId: constants.installationId,
        clientVersionCode: 10,
        clientVersionName: '0.8.12'
      }
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('registration updated') > 0)

    /* Check registger install second user */
    t.post({
      uri: '/do/find',
      body: {
        collection:'installs',
        find:{ _id:constants.installId }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].installationId)
      t.assert(body.data[0].registrationId)
      t.assert(body.data[0].users.length === 2)
      test.done()
    })
  })
}

exports.updateRegisteredInstallBeacons = function (test) {
  t.post({
    uri: '/do/getEntitiesByProximity?' + userCred,
    body: {
      beaconIds: [constants.beaconId],
      installationId: constants.installationId
    }
  }, function(err, res, body) {
    t.assert(body.count === dbProfile.epb)
    t.assert(body.data && body.data[0])

    /* Check install beacons */
    t.post({
      uri: '/do/find',
      body: {
        collection:'installs',
        find:{ _id:constants.installId }
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

exports.cannotInsertEntityNotLoggedIn = function (test) {
  t.post({
    uri: '/do/insertEntity',
    body: {
      entity:testPlace,
      beacons:[testBeacon],
      primaryBeaconId:testBeacon._id,
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
      returnMessages: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length == 0) // No notification because place is synthetic

    var savedEnt = body.data
    t.assert(savedEnt._owner === util.adminUser._id)
    t.assert(savedEnt._creator === testUser._id)
    t.assert(savedEnt._modifier === testUser._id)

    /* Check insert place */
    t.post({
      uri: '/do/find',
      body: {
        collection:'places',
        find:{ _id:testPlace._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /*
       * Check did not insert 'create' link. Create link requires
       * that user is both owner and creator.
       */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
            _from: testUser._id,
            _to: testPlace._id,
            type: 'create',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check inserted beacon */
        t.post({
          uri: '/do/find',
          body: {
            collection:'beacons',
            find:{ _id:testBeacon._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          // Beacons should be owned by admin
          t.assert(body.data[0]._owner === util.adminUser._id)
          // Creator and modifier should be user who first added them
          t.assert(body.data[0]._creator === testUser._id)
          t.assert(body.data[0]._modifier === testUser._id)

          /* Check inserted beacon link, store the link */
          t.post({
            uri: '/do/find',
            body: {
              collection:'links',
              find:{
                _to:testBeacon._id,
                _from:testPlace._id,
                'proximity.primary':true
              }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            primaryLink = body.data[0]

            /* Check inserted action */
            t.post({
              uri: '/do/find',
              body: {
                collection:'actions',
                find:{ _entity:testPlace._id, event:'insert_entity_place_linked'}
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

exports.insertPlaceCustom = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testPlaceCustom,
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length > 0)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(!body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUser._id)
    t.assert(savedEnt._creator === testUser._id)
    t.assert(savedEnt._modifier === testUser._id)

    /* Check insert place custom */
    t.post({
      uri: '/do/find',
      body: {
        collection:'places',
        find:{ _id:testPlaceCustom._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check insert 'create' link */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
            _from: testUser._id,
            _to: testPlaceCustom._id,
            type: 'create',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.insertPlaceBeaconAlreadyExists = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testPlace2,
      beacons:[testBeacon],
      primaryBeaconId:testBeacon._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    t.assert(body.messages.length == 0)

    /* Check insert place where beacon already exists */
    t.post({
      uri: '/do/find',
      body: {
        collection:'places',
        find:{ _id:testPlace2._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check beacon link count */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{ _to:testBeacon._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 3)
        test.done()
      })
    })
  })
}

exports.insertPlaceEntityWithNoLinks = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity:testPlace3,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.messages.length == 0)

    /* Check insert entity no links */
    t.post({
      uri: '/do/find',
      body: {
        collection:'places',
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
  })
}

exports.likeEntity = function(test) {
  t.post({
    uri: '/do/insertLink?' + userCred,
    body: {
      toId: testPlace2._id,
      fromId: testUser._id,
      type: util.statics.typeLike,
      actionEvent: 'like'
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check like entity link to entity 2 */
    t.post({
      uri: '/do/find',
      body: {
        collection:'links',
        find:{ _to:testPlace2._id, type: util.statics.typeLike }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check link entity log action */
      t.post({
        uri: '/do/find',
        body: {
          collection:'actions',
          find:{ _entity:testPlace2._id, event:'like'}
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
    uri: '/do/deleteLink?' + userCred,
    body: {
      toId: testPlace2._id,
      fromId: testUser._id,
      type: util.statics.typeLike,
      actionEvent: 'unlike'
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('successful') > 0)

    /* Check unlike entity */
    t.post({
      uri: '/do/find',
      body: {
        collection:'links',
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
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)

    /* Check track entity proximity links from entity 1 */
    t.post({
      uri: '/do/find',
      body: {
        collection:'links',
        find:{
          _from:testPlace._id,
          type:util.statics.typeProximity
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Check track entity proximity link from entity 1 to beacon 2 */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
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

        /* Check track entity log action */
        t.post({
          uri: '/do/find',
          body: {
            collection:'actions',
            find:{
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
    uri: '/do/untrackEntity?' + userCred,
    body: {
      entityId:testPlace._id,
      beaconIds:[testBeacon._id, testBeacon2._id, testBeacon3._id],
      primaryBeaconId:testBeacon2._id,
      actionEvent:'proximity_minus',
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('untracked') > 0)

    /* Check untrack entity proximity links from entity 1 */
    t.post({
      uri: '/do/find',
      body: {
        collection:'links',
        find:{
          _from:testPlace._id,
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
    uri: '/do/trackEntity?' + userCred,
    body: {
      entityId:testPlace._id,
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') > 0)

    /* Check track entity no beacons log action */
    t.post({
      uri: '/do/find',
      body: {
        collection:'actions',
        find:{
          _entity:testPlace._id,
          event:'entity_proximity'
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
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

      /* Check beacon location update */
      t.post({
        uri: '/do/find',
        body: {
          collection:'beacons',
          find:{ _id:testBeacon._id }
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

exports.insertPost = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testPost,
      link: {
        _to: testPlace._id,
        type: util.statics.typeContent,
      },
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length > 0)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)

    /* Check inserted post */
    t.post({
      uri: '/do/find',
      body: {
        collection:'posts',
        find: { _id: testPost._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])

      /* Check content link for post */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
            _from: testPost._id,
            _to: testPlace._id,
            type: 'content',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])

        /* Check create link for post */
        t.post({
          uri: '/do/find',
          body: {
            collection:'links',
            find:{
              _from: testUser._id,
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
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testComment,
      link: {
        _to: testPost._id,
        type: util.statics.typeContent,
      },
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length > 0)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)

    /* Check insert */
    t.post({
      uri: '/do/find',
      body: {
        collection:'comments',
        find: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])

      /* Check content link for comment */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
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
          uri: '/do/find',
          body: {
            collection:'links',
            find:{
              _from: testUser._id,
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

    /* Check update entity */
    t.get({
      uri: '/data/places/' + testPlace._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name === 'Testing super candi')
      test.done()
    })
  })
}

exports.insertLink = function (test) {
  t.post({
    uri: '/data/links?' + userCred,
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

exports.deletePost = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + adminCred,
    body: {
      entityId:testPost._id,
      verbose: true,
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check delete post */
    t.post({
      uri: '/do/find',
      body: {
        collection:'posts',
        find:{
          _id:testPost._id
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check delete all links to/from post */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
            $or: [
              { _to:testPost._id },
              { _from:testPost._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check delete linked comment */
        t.post({
          uri: '/do/find',
          body: {
            collection:'comments',
            find:{
              _id:testComment._id
            }
          }
        }, function(err, res, body) {
          t.assert(body.count === 0)

          /* Check delete all links to/from comment */
          t.post({
            uri: '/do/find',
            body: {
              collection:'links',
              find:{
                $or: [
                  { _to:testComment._id },
                  { _from:testComment._id },
                ]
              }
            }
          }, function(err, res, body) {
            t.assert(body.count === 0)

            /* Check delete post entity log actions */
            t.post({
              uri: '/do/find',
              body: {
                collection:'actions',
                find:{
                  $and: [
                    { event: { $ne: 'delete_entity_post' }},
                    { $or: [
                      { _entity: testPost._id },
                      { _toEntity: testPost._id },
                      { _fromEntity: testPost._id },
                    ]},
                  ]
                }
              }
            }, function(err, res, body) {
              t.assert(body.count === 0)

              /* Check delete comment log actions */
              t.post({
                uri: '/do/find',
                body: {
                  collection:'actions',
                  find:{
                    $or: [
                      { _entity: testComment._id },
                      { _toEntity: testComment._id },
                      { _fromEntity: testComment._id },
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
      })
    })
  })
}


exports.deletePlace = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + adminCred,
    body: {
      entityId:testPlace._id,
      verbose: true,
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check delete entity */
    t.post({
      uri: '/do/find',
      body: {
        collection:'places',
        find:{
          _id:testPlace._id
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check delete all links from/to place */
      t.post({
        uri: '/do/find',
        body: {
          collection:'links',
          find:{
            $or: [
              { _to: testPlace._id },
              { _from: testPlace._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)

        /* Check delete entity log actions */
        t.post({
          uri: '/do/find',
          body: {
            collection:'actions',
            find:{
              $and: [
                { event: { $ne: 'delete_entity_place' }},
                { $or: [
                  { _entity: testPlace._id },
                  { _toEntity: testPlace._id },
                  { _fromEntity: testPlace._id },
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
    uri: '/do/insertEntity?' + user2Cred,
    body: {
      entity: testComment2,
      link: {
        _to: testPlaceCustom._id,
        type: util.statics.typeContent
      },
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
        type: util.statics.typeContent
      },
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length > 0)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)

    /* Check owner inserted comment on locked record */
    t.post({
      uri: '/do/find',
      body: {
        collection:'comments',
        find:{ _id:testComment2._id }
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
      link: {
        _to: testPlaceCustom._id,
        type: util.statics.typeContent
      },
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.messages.length > 0)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)

    /* Check admin inserted comment on locked record */
    t.post({
      uri: '/do/find',
      body: {
        collection:'comments',
        find:{ _id:testComment3._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
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

    /* Check owner updated locked record */
    t.get({
      uri: '/data/places/' + testPlaceCustom._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name === 'Testing owner update of locked entity')
      test.done()
    })
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

    /* Check admin updated locked record */
    t.get({
      uri: '/data/places/' + testPlaceCustom._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name === 'Testing admin update of locked entity')
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
