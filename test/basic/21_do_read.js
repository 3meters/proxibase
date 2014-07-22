/**
 *  Proxibase custom methods test: reads
 */

var util = require('proxutils')
var statics = util.statics
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var dbProfile = testUtil.dbProfile
var constants = require('../constants')
var userCred
var user2Cred
var adminCred
var testUser = {
  _id : "us.111111.11111.111.111111",
  name : "John Q Test",
  type: 'user',
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
var _exports = {} // for commenting out tests

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

exports.getEntitiesMinimum = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId],
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linkInCounts && !record.linkOutCounts)
    t.assert(!record.entities && !record.users)
    test.done()
  })
}

exports.getEntitiesMaximum = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId], 
      links: {
        active: [
          { type:statics.typeProximity, schema:statics.schemaBeacon, links: true, count: true, direction: 'both' },
          { type:statics.typeContent, schema:statics.schemaApplink, links: true, count: true, direction: 'both' },
          { type:statics.typeContent, schema:statics.schemaComment, links: true, count: true, direction: 'both' },
          { type:statics.typeContent, schema:statics.schemaPost, links: true, count: true, direction: 'both' },
          { type:statics.typeContent, schema:statics.schemaMessage, links: true, count: true, direction: 'both' },
          { type:statics.typeWatch, schema:statics.schemaUser, links: true, count: true, direction: 'both' },
          { type:statics.typeLike, schema:statics.schemaUser, links: true, count: true, direction: 'both' },
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length)
    t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.mpp + dbProfile.likes + dbProfile.watch)
    t.assert(record.linksOut && record.linksOut.length === 1)
    t.assert(record.linksInCounts && record.linksInCounts.length === 6)
    t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
    test.done()
  })
}

exports.getEntitiesWithoutCommentInfo = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId], 
      links: {
        active: [ 
          { type:statics.typeProximity, schema:statics.schemaBeacon }, 
          { type:statics.typeContent, schema:statics.schemaApplink }, 
          { type:statics.typeContent, schema:statics.schemaComment, links: false, count: false }, 
          { type:statics.typeContent, schema:statics.schemaPost }, 
          { type:statics.typeWatch, schema:statics.schemaUser }, 
          { type:statics.typeLike, schema:statics.schemaUser }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksInCounts && record.linksInCounts.length === 4)
    t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
    t.assert(!record.linksIn && !record.linksOut)
    test.done()
  })
}

exports.getEntitiesAndLinkedEntitiesByUser = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId], 
      links: {
        loadWhere: { _creator: constants.uid1 },
        active: [ 
          { type:statics.typeProximity, schema:statics.schemaBeacon }, 
          { type:statics.typeContent, schema:statics.schemaApplink }, 
          { type:statics.typeContent, schema:statics.schemaComment, links: true, count: false }, 
          { type:statics.typeContent, schema:statics.schemaPost, links: true, count: false }, 
          { type:statics.typeWatch, schema:statics.schemaUser }, 
          { type:statics.typeLike, schema:statics.schemaUser }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    test.done()
  })
}

exports.getEntityLinksAndCountsForBeacon = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      links: {
        active: [ 
          { type:statics.typeProximity, schema:statics.schemaPlace, links: true, count: true }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length === dbProfile.epb)
    t.assert(record.linksInCounts && record.linksInCounts.length === 1)
    t.assert(body.date)
    test.done()
  })
}

exports.getEntitiesForLocationLimited = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId],
      links: {
        active: [ 
          { type:statics.typeContent, schema:statics.schemaPost, links: true, limit: 3 }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length === 3)
    test.done()
  })
}

exports.getEntitiesCreatedByUser = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.uid1,
      cursor: { 
        linkTypes: [statics.typeCreate], 
        direction: 'out',
      },
    }
  }, function(err, res, body) {
    t.assert(body.count > 0 && body.count <= statics.db.limits.default)
    test.done()
  })
}

exports.getEntitiesCreatedByUserSortSkipLimit = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.uid1,
      cursor: { 
        linkTypes: ['create'],
        direction: 'out',
        sort: {modifiedDate: -1},
        schemas: ['message']
      },
    }
  }, function(err, res, body) {
    t.assert(body.count > 0 && body.count <= statics.db.limits.default)
    var cUnlimited = body.count
    var lastModified = Infinity
    var ent3 = null
    body.data.forEach(function(ent, i) {
      t.assert(ent.modifiedDate <= lastModified)
      lastModified = ent.modifiedDate
      if (i === 3) ent3 = ent
    })
    t.post({
      uri: '/do/getEntitiesForEntity',
      body: {
        entityId: constants.uid1,
        cursor: {
          linkTypes: [statics.typeCreate],
          direction: 'out',
          schemas: ['message'],
          sort: {modifiedDate: -1},
          skip: 3,
          limit: 5,
        },
      }
    }, function(err, res, body) {
      t.assert(body.count === 5) // limit works
      t.assert(body.data[0]._id === ent3._id)  // skip works
      test.done()
    })
  })
}


exports.getEntitesLinksLimitSortSkip = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.uid1,
      cursor: {
        direction: 'out',
        linkTypes: ['create'],
        schemas: ['place'],
      },
      links : {
        active : [
          { count : true,
            direction : 'in',
            links : true,
            type : 'content',
            schema : 'message',
          },
        ],
        shortcuts : true
      }
    }
  }, function(req, res, body) {
    t.assert(body.data && body.data.length)
    var links = body.data[0].linksIn
    var link3 = null
    t.assert(links)
    t.assert(links.length === dbProfile.mpp)
    var lastSortDate = Infinity
    // getEntities hard-codes sort to modifiedDate: -1
    links.forEach(function(link, i) {
      t.assert(link.sortDate <= lastSortDate)
      lastSortDate = link.sortDate
      if (2 === i) link3 = link
    })

    t.post({
      uri: '/do/getEntitiesForEntity',
      body: {
        entityId: constants.uid1,
        cursor: {
          direction: 'out',
          linkTypes: ['create'],
          schemas: ['place'],
        },
        links : {
          active : [
            { count : true,
              direction : 'in',
              skip : 2,
              limit : 5,
              links : true,
              type : 'content',
              schema : 'message',
            },
          ],
          shortcuts : true
        }
      }
    }, function(req, res, body) {
      t.assert(body.data && body.data.length)
      var links = body.data[0].linksIn
      t.assert(links)
      t.assert(links.length === 5)            // limit works
      t.assert(links[0].shortcut.id === link3.shortcut.id, link3)   // skip works, note id, not _id

      t.post({
        uri: '/do/getEntitiesForEntity',
        body: {
          entityId: constants.uid1,
          cursor: {
            direction: 'out',
            linkTypes: ['create'],
            schemas: ['place'],
          },
          links : {
            active : [
              { count : true,
                direction : 'in',
                limit : 50,   // Issue 241
                links : true,
                type : 'content',
                schema : 'message',
              },
            ],
            shortcuts : true
          }
        }
      }, function(req, res, body) {
        t.assert(body.data && body.data.length)
        var links = body.data[0].linksIn
        t.assert(links)
        t.assert(links.length === dbProfile.mpp)   // Issue 241 fixed
        test.done()
      })
    })
  })
}


exports.getEntitiesCreatedByUserPostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.uid1,
      cursor: { 
        linkTypes: [statics.typeCreate], 
        schemas: [statics.schemaPost], 
        direction: 'out',
      },
    }
  }, function(err, res, body) {
    t.assert(body.count > 0 && body.count <= statics.db.limits.default)
    t.assert(body.data && body.data[0] && body.data[0].schema === statics.schemaPost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      cursor: { 
        linkTypes: [statics.typeContent], 
        schemas: [statics.schemaPost],
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === dbProfile.spe)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0] && body.data[0].schema === statics.schemaPost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimited = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      cursor: { 
        linkTypes: [statics.typeContent], 
        schemas: [statics.schemaPost],
        sort: { modifiedDate: -1 },
        limit: 3,
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === statics.schemaPost)
    t.assert(body.data[0].name.indexOf('Lisa 4') > 0, body.data[0])
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimitedAndSkip = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId,
      cursor: {
        linkTypes: [statics.typeContent],
        schemas: [statics.schemaPost],
        sort: { modifiedDate: -1 },
        limit: 2,
        skip: 2
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === util.statics.schemaPost)
    t.assert(body.data[0].name.indexOf('Lisa 2') > 0)  // skipped 4 and 3
    test.done()
  })
}

exports.getUserMinimum = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities?' + userCred,
    body: {
      entityIds: [constants.uid1],
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linkInCounts && !record.linkOutCounts)
    t.assert(!record.entities && !record.users)
    t.assert(record.name)
    t.assert(!record.role)  // non-public field
    test.done()
  })
}

exports.getUserViaGetEntitiesForEntity = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + userCred,
    body: {
      entityId: constants.placeId,
      cursor: {direction: 'in',
        limit: 50,
        linkTypes: ['watch'],
        schemas: ['user'],
        skip: 0,
        sort: {modifiedDate: -1},
      },
      shortcuts: true,
    }
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.data && body.data.length)
    body.data.forEach(function(record) {
      t.assert(record.name)
      t.assert(!record.email)
    })
    test.done()
  })
}

exports.getUsersFromAnon = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.uid1],
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linkInCounts && !record.linkOutCounts)
    t.assert(!record.entities && !record.users)
    t.assert(record.name)
    t.assert(!record.role)  // non-public field
    test.done()
  })
}

exports.getUsersFromOwnUserGetsPrivateFields = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  t.post({
    uri: '/do/getEntities?' + userCred,
    body: {
      entityIds: [testUser._id],
    },
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linkInCounts && !record.linkOutCounts)
    t.assert(!record.entities && !record.users)
    t.assert(record.name)
    t.assert(record.role)  // non-public field
    test.done()
  })
}

