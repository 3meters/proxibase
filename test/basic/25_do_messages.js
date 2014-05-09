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
var adminCred
var _exports = {} // for commenting out tests
var testLatitude = 46.1
var testLongitude = -121.1
var installId1 = '5905d547-8321-4612-abe1-00001'
var installId2 = '5905d547-8321-4612-abe1-00002'
var expirationDate

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

var testMessage = {
  _id : "me.111111.11111.111.222222",
  schema : util.statics.schemaMessage,
  type : "root",
  description : "Go seahawks!",
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source:"aircandi",
  },
}

var testReply = {
  _id : "me.111111.11111.111.111112",
  schema : util.statics.schemaMessage,
  type : "reply",
  description : "Repeat! Repeat!",
  _root : "me.111111.11111.111.222222",
  _replyTo: testUserBob._id,
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

/* Get user and admin sessions and store the credentials in module globals */
exports.getSessions = function (test) {
  testUtil.getUserSession(testUserTom, function(session) {
    userCredTom = 'user=' + session._owner + '&session=' + session.key
    testUtil.getUserSession(testUserBob, function(session) {
      userCredBob = 'user=' + session._owner + '&session=' + session.key
      testUtil.getAdminSession(function(session) {
        adminCred = 'user=' + session._owner + '&session=' + session.key
        test.done()
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
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    test.done()
  })
}

exports.insertMessage = function (test) {

  t.post({
    uri: '/do/insertEntity?' + userCredBob,
    body: {
      entity: testMessage,
      links: [{
        _to: testPlaceCustom._id,
        type: util.statics.typeContent
      }],
      returnMessages: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Tom gets a message because he owns the place that the message
     * is being sent to.
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
        t.assert(link._creator === testUserBob._id)
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
    uri: '/do/insertEntity?' + userCredTom,
    body: {
      entity: testReply,
      links: [
        {
          _to: testPlaceCustom._id,          // Toms place, reply to Bobs message
          type: util.statics.typeContent,
        }],
      returnMessages: true,
      activityDateWindow: 0,
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    /*
     * Bob gets a message because he is nearby.
     *
     * If not run stand-alone, Alice create in previous test module
     * gets a message because she is watching tom.
     */
    t.assert(body.messages.length >= 1)
    var bobHit = false
    body.messages.forEach(function(message) {
      t.assert(message.action.user && message.action.entity)
      t.assert(message.action.toEntity && message.action.toEntity.id == testPlaceCustom._id)
      if (message.registrationIds[0].indexOf('bob') > 0 && message.trigger == 'nearby') bobHit = true
    })
    t.assert(bobHit)

    var savedEnt = body.data
    t.assert(savedEnt._owner === testUserTom._id)
    t.assert(savedEnt._creator === testUserTom._id)
    t.assert(savedEnt._modifier === testUserTom._id)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/find/messages',
      body: {
        query:{ _id:testReply._id }
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
