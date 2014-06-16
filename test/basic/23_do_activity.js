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
var primaryLink
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
var placeMovedToId

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

var testPlaceCustom = {
  _id : "pl.111111.11111.111.211114",
  schema : util.statics.schemaPlace,
  name : "Testing place entity custom one for messages",
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
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"4259950006",
  category:{
    id:"4bf58dd8d48988d18c941735",
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
}

var testPlaceCustomTwo = {
  _id : "pl.111111.11111.111.211115",
  schema : util.statics.schemaPlace,
  name : "Testing place entity custom two",
  locked: true,
  photo: {
    prefix:"1001_20111224_104245.jpg",
    source:"aircandi"
  },
  signalFence : -100,
  location: {
    lat:testLatitude, lng:testLongitude, altitude:12, accuracy:30, geometry:[testLongitude, testLatitude]
  },
  address:"123 Main St", city:"Fremont", region:"WA", country:"USA", phone:"4259950007",
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
}

var testMessage = {
  _id : "me.111111.11111.111.111111",
  schema : util.statics.schemaMessage,
  name : "Testing message entity",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
}

var testComment = {
  _id : "co.111111.11111.111.111114",
  schema : util.statics.schemaComment,
  name : "Test comment",
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
  popularity: 100,
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
  popularity: 100
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

/* Get user and admin sessions and store the credentials in module globals */
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
      log('this next assert will fail if the test is run stand-alone')
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

    /* Check register install third user */
    t.post({
      uri: '/find/installs?' + adminCred,
      body: {
        query:{ installId: installId3 }
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
      beaconIds: [testBeacon._id],
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
 * Messages
 * ----------------------------------------------------------------------------
 */

exports.insertCustomPlace = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testPlaceCustom,    // custom place
      beacons: [testBeacon],
      primaryBeaconId: testBeacon._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    /*
     * Bob should get a nearby message since he is registered
     * with beacons that intersect the ones for custom place three.
     *
     * Tom should not get a message because he is the source.
     *
     * Alice gets a message because she is watching Tom.
     */
    t.assert(body.messages.length == 2)
    body.messages.forEach(function(message) {
      t.assert(message.action.user && message.action.entity)
      t.assert(!message.action.toEntity)
      t.assert(message.trigger == 'nearby' || message.trigger == 'watch_user')
      t.assert(message.registrationIds[0].indexOf('bob') > 0 || message.registrationIds[0].indexOf('alice') > 0)
    })
    test.done()
  })
}


exports.insertCustomPlaceTwo = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testPlaceCustomTwo,    // custom place
      beacons: [testBeacon2],
      primaryBeaconId: testBeacon2._id,
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    /*
     * Alice should get a nearby message since alice is registered
     * with beacons that intersect the ones for custom place two.
     *
     * Bob should not get a message because he is the source.
     */
    t.assert(body.messages && body.messages.length == 1)
    t.assert(body.messages[0].action.user && body.messages[0].action.entity)
    t.assert(!body.messages[0].action.toEntity)
    t.assert(!body.messages[0].action.fromEntity)
    t.assert(body.messages[0].trigger == 'nearby')
    t.assert(body.messages[0].registrationIds[0].indexOf('alice') > 0)

    test.done()
  })
}


exports.cannotUpdateApplinksforLockedPlaceOwnedByAnotherUser = function(test) {
  t.post({
    uri: '/do/replaceEntitiesForEntity?' + userCredTom,  // place is owned by Bob
    body: {
      entityId: testPlaceCustomTwo._id,
      entities: [
        util.clone(testApplink),
        util.clone(testApplink),
        util.clone(testApplink)],
      schema: util.statics.schemaApplink,
      activityDateWindow: 0,
      verbose: true,
    }
  }, 401, function(err, res, body) {
    t.assert(401.6 === body.error.code)

    /* Now have bob unlock it */
    t.post({
      uri: '/data/places/' + testPlaceCustomTwo._id + '?' + userCredBob,
      body: {data: {locked: false}},
    }, function(err, res, body) {
      t.assert(false === body.data.locked)
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
        _to: testPlaceCustom._id,          // Tom's place
        type: util.statics.typeContent
      }],
      returnMessages: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom should get a notification message because he owns the place that the message
     * is being added to.
     */
    t.assert(body.messages.length == 1)
    body.messages.forEach(function(message) {
      t.assert(message.action.user && message.action.entity)
      t.assert(message.action.toEntity && message.action.toEntity.id == testPlaceCustom._id)
      t.assert(message.trigger == 'own_to')
      t.assert(message.registrationIds[0].indexOf('tom') > 0)
    })

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserBob._id)
    t.assert(savedEnt._creator === testUserBob._id)
    t.assert(savedEnt._modifier === testUserBob._id)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/find/messages',
      body: {
        query:{ _id:testMessage._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

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
}


/*
 * ----------------------------------------------------------------------------
 * Add and replace entity set
 * ----------------------------------------------------------------------------
 */

exports.addEntitySet = function (test) {
  t.post({
    uri: '/do/replaceEntitiesForEntity?' + userCredTom,
    body: {
      entityId: testPlaceCustom._id,
      entities: [
        util.clone(testApplink),
        util.clone(testApplink),
        util.clone(testApplink)],
      schema: util.statics.schemaApplink,
      activityDateWindow: 0,
    }
  }, 200, function(err, res, body) {
    t.assert(body.info.indexOf('replaced') > 0)
    var activityDate = body.date

    /* Check for three links */
    t.post({
      uri: '/find/links',
      body: {
        query: { _to: testPlaceCustom._id, type: util.statics.typeContent, fromSchema: util.statics.schemaApplink }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Check for three applinks */
      t.post({
        uri: '/find/applinks',
        body: {
          query: { name:'Applink' }
        }
      }, function(err, res, body) {
        t.assert(body.count === 3)

        /* Check activityDate and _applinkModifier for place */
        t.post({
          uri: '/find/places',
          body: {
            query:{ _id: testPlaceCustom._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate >= activityDate)
          t.assert(body.data[0]._applinkModifier === testUserTom._id)
          test.done()
        })
      })
    })
  })
}

exports.replaceEntitySet = function (test) {
  t.post({
    uri: '/do/replaceEntitiesForEntity?' + userCredTom,
    body: {
      entityId: testPlaceCustom._id,
      entities: [
        util.clone(testApplink2),
        util.clone(testApplink2),
        util.clone(testApplink2)],
      schema: util.statics.schemaApplink,
      activityDateWindow: 0,
      verbose: true,
    }
  }, 200, function(err, res, body) {
    t.assert(body.info.indexOf('replaced') > 0)
    var activityDate = body.date

    /* Confirm new links */
    t.post({
      uri: '/find/links',
      body: {
        query: { _to: testPlaceCustom._id, type: util.statics.typeContent, fromSchema: util.statics.schemaApplink }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Confirm new applinks */
      t.post({
        uri: '/find/applinks',
        body: {
          query: { name:'Applink New' }
        }
      }, function(err, res, body) {
        t.assert(body.count === 3)

        /* Confirm old applinks are gone */
        t.post({
          uri: '/find/applinks',
          body: {
            query: { name:'Applink' }
          }
        }, function(err, res, body) {
          t.assert(body.count === 0)

          /* Check activityDate for place */
          t.post({
            uri: '/find/places',
            body: {
              query:{ _id: testPlaceCustom._id }
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

/*
 * ----------------------------------------------------------------------------
 * Check activityDate when insert, update, and delete entities
 * ----------------------------------------------------------------------------
 */

exports.insertComment = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testComment,
      links: [{
        _to: testMessage._id,
        type: util.statics.typeContent,
      }],
      returnMessages: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Bob should get a notification message because he owns the message
     * Alice should get a notification message because she is watching Tom.
     */
    t.assert(body.messages.length == 2)
    body.messages.forEach(function(message) {
      t.assert(message.action.user && message.action.entity)
      t.assert(message.action.toEntity && message.action.toEntity.id == testMessage._id)
      t.assert(message.trigger == 'own_to' || message.trigger == 'watch_user')
      t.assert(message.registrationIds[0].indexOf('bob') > 0 || message.registrationIds[0].indexOf('alice') > 0)
    })

    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/find/comments',
      body: {
        query: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(!body.data[0].activityDate)

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

        /* Check activityDate for message */
        t.post({
          uri: '/find/messages',
          body: {
            query:{ _id: testMessage._id }
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

exports.updateEntity = function (test) {
  testComment.name = 'Testing comment update'
  t.post({
    uri: '/do/updateEntity?' + userCredTom,
    body: {
      entity:testComment
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    var activityDate = body.date

    /* Check update */
    t.post({
      uri: '/find/comments',
      body: {
        query: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].activityDate != activityDate)

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

        /* Check activityDate for message */
        t.post({
          uri: '/find/messages',
          body: {
            query:{ _id: testMessage._id }
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

exports.deleteEntity = function (test) {
  t.post({
    uri: '/do/deleteEntity?' + adminCred,
    body: {
      entityId:testComment._id,
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    var activityDate = body.date
    /* Check delete */
    t.post({
      uri: '/find/comments',
      body: {
        query: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

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

        /* Check activityDate for message */
        t.post({
          uri: '/find/messages',
          body: {
            query:{ _id: testMessage._id }
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

/*
 * ----------------------------------------------------------------------------
 * A bit of cleanup so #25 gets the right stuff
 * ----------------------------------------------------------------------------
 */

exports.unwatchUser = function(test) {
  t.post({
    uri: '/do/deleteLink?' + userCredAlice,
    body: {
      toId: testUserTom._id,
      fromId: testUserAlice._id,
      type: util.statics.typeWatch,
      actionEvent: 'unwatch'
    }
  }, function(err, res, body) {
    t.assert(body.info.indexOf('successful') > 0)

    /* Check unwatch entity */
    t.post({
      uri: '/find/links',
      body: {
        query:{
          _to:testUserTom._id,
          _from:testUserBob._id,
          type:util.statics.typeWatch
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}
