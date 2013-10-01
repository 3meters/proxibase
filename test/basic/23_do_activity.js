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
var placeMovedToId
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
  _id : clIds.comments + ".111111.11111.111.111114",
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

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(testUser, function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key

    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

/* Candigrams */

exports.insertCandigramBounce = function (test) {
  testCandigramBounce.hopLastDate = util.now()
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testCandigramBounce,
      link: {
        _to: testPlace2._id,
        strong: false,
        type: util.statics.typeContent
      },
      skipNotifications: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    var savedEnt = body.data
    t.assert(savedEnt._owner === testUser._id)
    t.assert(savedEnt._creator === testUser._id)
    t.assert(savedEnt._modifier === testUser._id)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/do/find',
      body: {
        table:'candigrams',
        find:{ _id:testCandigramBounce._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)

      /* Check activityDate for place */
      t.post({
        uri: '/do/find',
        body: {
          table:'places',
          find:{ _id:testPlace2._id }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert(body.data[0].activityDate == activityDate)
        test.done()
      })
    })
  })
}

exports.moveCandigram = function(test) {
  t.post({
    uri: '/do/moveCandigrams?' + userCred,
    body: {
      entityIds:[testCandigramBounce._id],
      method: 'proximity',
      skipNotifications: true
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])

    var newPlace = body.data[0]
    placeMovedToId = newPlace._id
    var activityDate = body.date

    /* Check place link inactive */
    t.post({
      uri: '/do/find',
      body: {
        table:'links',
        find:{
          _from:testCandigramBounce._id,
          _to:testPlace2._id,
          type:util.statics.typeContent,
        }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].inactive === true)

      /* Check new place link active */
      t.post({
        uri: '/do/find',
        body: {
          table:'links',
          find:{
            _from: testCandigramBounce._id,
            type: util.statics.typeContent,
            inactive: false,
          }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])

        /* Check activityDate for old place */
        t.post({
          uri: '/do/find',
          body: {
            table:'places',
            find:{ _id:testPlace2._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate == activityDate)

          /* Check activityDate for new place */
          t.post({
            uri: '/do/find',
            body: {
              table:'places',
              find:{ _id:newPlace._id }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data && body.data[0])
            t.assert(body.data[0].activityDate == activityDate)

            /* Check activityDate for candigram */
            t.post({
              uri: '/do/find',
              body: {
                table:'candigrams',
                find:{ _id: testCandigramBounce._id }
              }
            }, function(err, res, body) {
              t.assert(body.count === 1)
              t.assert(body.data && body.data[0])
              t.assert(body.data[0].activityDate == activityDate)
              test.done()
            })
          })
        })
      })
    })
  })
}

/* Replace an entity set */

exports.addEntitySet = function (test) {
  t.post({
    uri: '/do/replaceEntitiesForEntity?' + userCred,
    body: {
      entityId: testPlace2._id,
      entities: [
        util.clone(testApplink),
        util.clone(testApplink),
        util.clone(testApplink)],
      schema: util.statics.schemaApplink,
    }
  }, 200, function(err, res, body) {
    t.assert(body.info.indexOf('replaced') > 0)
    var activityDate = body.date

    /* Check for three links */
    t.post({
      uri: '/do/find',
      body: {
        table:'links',
        find: { _to: testPlace2._id, type: util.statics.typeContent, fromSchema: util.statics.schemaApplink }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Check for three applinks */
      t.post({
        uri: '/do/find',
        body: {
          table:'applinks',
          find: { name:'Applink' }
        }
      }, function(err, res, body) {
        t.assert(body.count === 3)

        /* Check activityDate for place */
        t.post({
          uri: '/do/find',
          body: {
            table:'places',
            find:{ _id: testPlace2._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate == activityDate)
          test.done()
        })
      })
    })
  })
}

exports.replaceEntitySet = function (test) {
  t.post({
    uri: '/do/replaceEntitiesForEntity?' + userCred,
    body: {
      entityId: testPlace2._id,
      entities: [
        util.clone(testApplink2),
        util.clone(testApplink2),
        util.clone(testApplink2)],
      schema: util.statics.schemaApplink,
    }
  }, 200, function(err, res, body) {
    t.assert(body.info.indexOf('replaced') > 0)
    var activityDate = body.date

    /* Confirm new links */
    t.post({
      uri: '/do/find',
      body: {
        table:'links',
        find: { _to: testPlace2._id, type: util.statics.typeContent, fromSchema: util.statics.schemaApplink }
      }
    }, function(err, res, body) {
      t.assert(body.count === 3)

      /* Confirm new applinks */
      t.post({
        uri: '/do/find',
        body: {
          table:'applinks',
          find: { name:'Applink New' }
        }
      }, function(err, res, body) {
        t.assert(body.count === 3)

        /* Confirm old applinks are gone */
        t.post({
          uri: '/do/find',
          body: {
            table:'applinks',
            find: { name:'Applink' }
          }
        }, function(err, res, body) {
          t.assert(body.count === 0)

          /* Check activityDate for place */
          t.post({
            uri: '/do/find',
            body: {
              table:'places',
              find:{ _id: testPlace2._id }
            }
          }, function(err, res, body) {
            t.assert(body.count === 1)
            t.assert(body.data && body.data[0])
            t.assert(body.data[0].activityDate == activityDate)
            test.done()
          })
        })
      })
    })
  })
}

/* Insert, update, and delete entities */

exports.insertComment = function (test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: testComment,
      link: {
        _to: testCandigramBounce._id,
        strong: true,
        type: util.statics.schemaComment
      },
      skipNotifications: true
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    var activityDate = body.date

    /* Check insert */
    t.post({
      uri: '/do/find',
      body: {
        table:'comments',
        find: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].activityDate != activityDate)

      /* Check activityDate for place */
      t.post({
        uri: '/do/find',
        body: {
          table:'places',
          find:{ _id:placeMovedToId }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert(body.data[0].activityDate == activityDate)

        /* Check activityDate for candigram */
        t.post({
          uri: '/do/find',
          body: {
            table:'candigrams',
            find:{ _id: testCandigramBounce._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate == activityDate)
          test.done()
        })
      })
    })
  })
}

exports.updateEntity = function (test) {
  testComment.name = 'Testing comment update'
  t.post({
    uri: '/do/updateEntity?' + userCred,
    body: {
      entity:testComment
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data._id)
    var activityDate = body.date

    /* Check update */
    t.post({
      uri: '/do/find',
      body: {
        table:'comments',
        find: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data && body.data[0])
      t.assert(body.data[0].activityDate != activityDate)

      /* Check activityDate for place */
      t.post({
        uri: '/do/find',
        body: {
          table:'places',
          find:{ _id:placeMovedToId }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert(body.data[0].activityDate == activityDate)

        /* Check activityDate for candigram */
        t.post({
          uri: '/do/find',
          body: {
            table:'candigrams',
            find:{ _id: testCandigramBounce._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate == activityDate)
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
      uri: '/do/find',
      body: {
        table:'comments',
        find: { _id: testComment._id }
      }
    }, function(err, res, body) {
      t.assert(body.count === 0)

      /* Check activityDate for place */
      t.post({
        uri: '/do/find',
        body: {
          table:'places',
          find:{ _id:placeMovedToId }
        }
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data && body.data[0])
        t.assert(body.data[0].activityDate == activityDate)

        /* Check activityDate for candigram */
        t.post({
          uri: '/do/find',
          body: {
            table:'candigrams',
            find:{ _id: testCandigramBounce._id }
          }
        }, function(err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data && body.data[0])
          t.assert(body.data[0].activityDate == activityDate)
          test.done()
        })
      })
    })
  })
}