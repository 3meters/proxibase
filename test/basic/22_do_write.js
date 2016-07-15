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
var watchLinkId
var activityDatePatch
var modifiedDatePatch
var activityDatePatchRefreshed
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
var testPatchOne = {
  _id : "pa.111111.11111.111.111111",
  schema : util.statics.schemaPatch,
  name : "Testing patch entity",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: 'place',
}

var testPatchTwo = {
  _id : "pa.111111.11111.111.111112",
  schema : util.statics.schemaPatch,
  name : "Testing patch entity",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: 'place',
}
var testPatchCustomPublic = {
  _id : "pa.111111.11111.111.211111",
  schema : util.statics.schemaPatch,
  name : "Testing patch entity custom",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: "place",
  visibility: "public",
}

var testPatchCustomLocked = {
  _id : "pa.111111.11111.111.211113",
  schema : util.statics.schemaPatch,
  name : "Testing patch entity custom locked",
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi.images"
  },
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  type: 'place',
  visibility: "public",
  locked: true,
}

var testMessage = {
  _id : "me.111111.11111.111.111111",
  schema : util.statics.schemaMessage,
  name : "Testing message entity",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi.images",
  },
}

var testBeacon = {
  _id : 'be.11:11:11:11:11:11',
  schema : util.statics.schemaBeacon,
  name: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: '11:11:11:11:11:11',
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
  location: {
    lat:testLatitude,
    lng:testLongitude,
    altitude:12,
    accuracy:30,
    geometry:[testLongitude, testLatitude]
  },
}

var testLink = {
  _to : testMessage._id,
  _from : testUserTom._id,
  type: 'like',
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
        parseInstallId: 'registration_id_testing_user_bob',
        installId: installId1,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
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
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_bob')
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
        parseInstallId: 'registration_id_testing_user_tom',
        installId: installId1,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
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
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_tom')
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
        parseInstallId: 'registration_id_testing_user_bob',
        installId: installId2,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
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
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_bob')
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
        parseInstallId: 'registration_id_testing_user_alice',
        installId: installId3,
        clientVersionCode: 10,
        clientVersionName: '0.8.12',
        deviceType: 'android',
        deviceVersionName: '5.0.0',
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
      t.assert(body.data[0].parseInstallId)
      t.assert(body.data[0].parseInstallId === 'registration_id_testing_user_alice')
      t.assert(body.data[0].users && body.data[0].users.length === 1)
      t.assert(body.data[0].signinDate)
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
    uri: '/do/updateProximity?' + userCredBob,
    body: {
      beaconIds: [testBeacon._id],
      installId: installId2
    }
  }, function(err, res, body) {
    t.assert(body.info && body.info.toLowerCase().indexOf('install updated') >= 0)

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
    uri: '/do/updateProximity?' + userCredAlice,
    body: {
      beaconIds: [testBeacon2._id],
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

/*
 * ----------------------------------------------------------------------------
 * Insert patches
 * ----------------------------------------------------------------------------
 */

exports.insertPatchOne = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPatchOne,
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserTom._id)
    t.assert(savedEnt._creator === testUserTom._id)
    t.assert(savedEnt._modifier === testUserTom._id)

    /* Check insert patch */
    t.post({
      uri: '/find/patches',
      body: {
        query: { _id: testPatchOne._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /*
       * Check inserted 'create' link.
       */
      t.post({
        uri: '/find/links',
        body: {
          query: {
            _from: testUserTom._id,
            _to: testPatchOne._id,
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

exports.insertPatchCustomPublic = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPatchCustomPublic,
      beacons: [testBeacon],
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserTom._id)
    t.assert(savedEnt._creator === testUserTom._id)
    t.assert(savedEnt._modifier === testUserTom._id)

    /* Check insert patch custom */
    t.post({
      uri: '/find/patches',
      body: {
        query: { _id:testPatchCustomPublic._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Used in later test */
      activityDatePatch = body.data[0].activityDate
      modifiedDatePatch = body.data[0].modifiedDate

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
              _from:testPatchCustomPublic._id,
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
                _to: testPatchCustomPublic._id,
                type: 'create',
              }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            test.done()
          })
        })
      })
    })
  })
}

exports.insertPatchCustomLockedWithNoLinks = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPatchCustomLocked,
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check insert entity no links */
    t.post({
      uri: '/find/patches',
      body: {
        query:{_id:testPatchCustomLocked._id}
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


/*
 * ----------------------------------------------------------------------------
 * Track and untrack
 * ----------------------------------------------------------------------------
 */

exports.trackEntityProximity = function(test) {
  t.post({
    uri: '/do/trackEntity?' + userCredTom,
    body: {
      entityId: testPatchOne._id,
      beacons: [testBeacon, testBeacon2, testBeacon3],
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') >= 0)

    /* Check track entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPatchOne._id,
          type: 'proximity',
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
            _from:testPatchOne._id,
            type:'proximity',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}

exports.untrackEntityProximity = function(test) {
  t.post({
    uri: '/do/untrackEntity?' + userCredTom,
    body: {
      entityId:testPatchOne._id,
      beacons:[testBeacon, testBeacon2, testBeacon3],
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('Untracked') >= 0)

    /* Check untrack entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPatchOne._id,
          type:'proximity',
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
      entityId:testPatchOne._id,
      beacons:[testBeacon, testBeacon2, testBeacon3],
      actionEvent:'proximity',
    }
  }, function(err, res, body) {
    t.assert(body.info.toLowerCase().indexOf('tracked') >= 0)

    /* Check track entity proximity links from entity 1 */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _from:testPatchOne._id,
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
            _from:testPatchOne._id,
            type:util.statics.typeProximity
          }
        }
      }, function(err, res, body) {
        trackingLink = body.data[0]
        t.assert(body.count === 1)
        t.assert(body.data[0].signal === testBeacon2.signal)
        test.done()
      })
    })
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
 * Insert, update, delete messages
 * ----------------------------------------------------------------------------
 */

// Liking a patch will not update its activityDate.  Changed 12/20/15.
// Before then liking would tickle activityDate.
exports.checkPatchActivityDate = function (test) {
  t.post({
    uri: '/data/links?' + userCredTom,
    body: {
      data: {
        _from: testUserTom._id,
        _to: testPatchCustomPublic._id,
        type: 'like',
      },
      test: true,    // sets the activityDateWindow to 0
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.post({
     uri: '/do/getEntities',
     body: {
       entityIds: [testPatchCustomPublic._id],
     }
    }, function(err, res, body) {
     t.assert(body.count === 1)
     t.assert(body.data[0].activityDate > activityDatePatch, activityDatePatch)  // Changed liking to not tickle on 12/20/15, and back again to tickle on 7/15/15 :)
     test.done()
    })
  })
}

exports.insertMessage = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testMessage,
      links: [{
        _to: testPatchCustomPublic._id,
        type: util.statics.typeContent,
      }],
      test: true,   // sets activityDate window to 0
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)

    /* Check inserted message */
    t.post({
      uri: '/find/messages?' + userCredBob,
      body: {
        query: { _id: testMessage._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])

      /* Check content link for message */
      t.post({
        uri: '/find/links?' + userCredBob,
        body: {
          query:{
            _from: testMessage._id,
            _to: testPatchCustomPublic._id,
            type: 'content',
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])

        /* Check create link for message */
        t.post({
          uri: '/find/links?' + userCredBob,
          body: {
            query:{
              _from: testUserBob._id,
              _to: testMessage._id,
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

// Verify that the patch's activityDate has been updated
exports.getPatchWithStaleTimestamp = function (test) {
   t.post({
     uri: '/do/getEntities',
     body: {
       entityIds: [testPatchCustomPublic._id],
     }
   }, function(err, res, body) {
     t.assert(body.count === 1)
     t.assert(body.data[0].activityDate > activityDatePatch, activityDatePatch)
     activityDatePatch = body.data[0].activityDate
     test.done()
   })
}

exports.getMessagesWithStaleTimestamp = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?',
    body: {
      entityId: testPatchCustomPublic._id,
      where: { activityDate: { '$gte': activityDatePatch }},
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
     * Should see one messages.
     */
    t.assert(body.data)
    t.assert(body.count === 1)
    t.assert(body.entity)
    test.done()
  })
}

exports.noMessagesWithFreshTimestamp = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?',
    body: {
      entityId: testPatchCustomPublic._id,
      where: { activityDate: { '$gt': activityDatePatchRefreshed }},
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
     * Should see no messages.
     */
    t.assert(body.data)
    t.assert(body.count === 0)
    t.assert(!body.entity)
    test.done()
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

exports.deleteMessage = function (test) {
  t.del({
    uri: '/data/messages/' + testMessage._id + '?' + userCredBob
  }, function(err, res, body) {
    t.assert(body.count === 1)

    /* Check delete message */
    t.post({
      uri: '/find/messages',
      body: {
        query:{
          _id:testMessage._id
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
              { _to:testMessage._id },
              { _from:testMessage._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}

/*
 * ----------------------------------------------------------------------------
 * Update and delete patches
 * ----------------------------------------------------------------------------
 */

exports.updatePatchOwnedByMe= function (test) {
  testPatchOne.name = 'This change will take'
  testPatchOne.photo = {prefix: 'newPhoto.jpg', source:'generic'}
  t.post({
    uri: '/do/updateEntity?' + userCredTom,
    body: {
      entity:testPatchOne
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check update entity */
    t.get({
      uri: '/data/patches/' + testPatchOne._id
    }, function(err, res, body) {
      var patch = body.data
      t.assert(patch)
      t.assert(patch.photo && patch.photo.prefix === 'newPhoto.jpg')
      t.assert(testUserTom._id === patch._modifier)
      t.assert(patch.name === 'This change will take')
      test.done()
    })
  })
}

exports.userCantDeleteEntityTheyDontOwn = function (test) {
  t.del({
    uri: '/data/patches/' + testPatchOne._id + '?' + userCredAlice
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.deletePatch = function (test) {
  t.del({
    uri: '/data/patches/' + testPatchOne._id + '?' + userCredTom
  }, function(err, res, body) {
    t.assert(body.count === 1)
    // t.assert(body.data && body.data._id)

    /* Check delete entity */
    t.post({
      uri: '/find/patches',
      body: {
        query:{
          _id:testPatchOne._id
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check delete all links from/to patch */
      t.post({
        uri: '/find/links',
        body: {
          query:{
            $or: [
              { _to: testPatchOne._id },
              { _from: testPatchOne._id },
            ]
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}

exports.ownerCanUpdateLockedRecord = function(test) {
  testPatchCustomLocked.name = 'Testing owner update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + userCredTom,
    body: {
      entity:testPatchCustomLocked
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check owner updated locked record */
    t.get({
      uri: '/data/patches/' + testPatchCustomLocked._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name.indexOf('update') >= 0)
      test.done()
    })
  })
}

exports.adminCanUpdateLockedRecord = function(test) {
  testPatchCustomLocked.name = 'Testing admin update of locked entity'
  t.post({
    uri: '/do/updateEntity?' + adminCred,
    body: {
      entity:testPatchCustomLocked
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)

    /* Check admin updated locked record */
    t.get({
      uri: '/data/patches/' + testPatchCustomLocked._id
    }, function(err, res, body) {
      t.assert(body.data && body.data && body.data.name.indexOf('update') >= 0)
      test.done()
    })
  })
}
