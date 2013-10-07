/**
 *  Proxibase custom methods test: reads
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var dbProfile = constants.dbProfile.smokeTest
var userCred
var user2Cred
var adminCred
var usersClId = util.statics.collectionIds.users
var testUser = {
  _id : usersClId + ".111111.11111.111.111111",
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
          { type:util.statics.typeProximity, schema:util.statics.schemaBeacon, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeContent, schema:util.statics.schemaApplink, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeContent, schema:util.statics.schemaComment, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeContent, schema:util.statics.schemaPost, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeWatch, schema:util.statics.schemaUser, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeLike, schema:util.statics.schemaUser, links: true, count: true, direction: 'both' }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    log('links ln', record.linksIn.length)
    log('dbProfile', dbProfile)
    record.linksIn.forEach(function(link) {
      log('type: ' + link.type)
    })
    t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + dbProfile.watch)
    t.assert(record.linksOut && record.linksOut.length === 1)
    t.assert(record.linksInCounts && record.linksInCounts.length === 5)
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
          { type:util.statics.typeProximity, schema:util.statics.schemaBeacon }, 
          { type:util.statics.typeContent, schema:util.statics.schemaApplink }, 
          { type:util.statics.typeContent, schema:util.statics.schemaComment, links: false, count: false }, 
          { type:util.statics.typeContent, schema:util.statics.schemaPost }, 
          { type:util.statics.typeWatch, schema:util.statics.schemaUser }, 
          { type:util.statics.typeLike, schema:util.statics.schemaUser }, 
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
          { type:util.statics.typeProximity, schema:util.statics.schemaBeacon }, 
          { type:util.statics.typeContent, schema:util.statics.schemaApplink }, 
          { type:util.statics.typeContent, schema:util.statics.schemaComment, links: true, count: false }, 
          { type:util.statics.typeContent, schema:util.statics.schemaPost, links: true, count: false }, 
          { type:util.statics.typeWatch, schema:util.statics.schemaUser }, 
          { type:util.statics.typeLike, schema:util.statics.schemaUser }, 
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
          { type:util.statics.typeProximity, schema:util.statics.schemaPlace, links: true, count: true }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length === 5)
    t.assert(record.linksInCounts && record.linksInCounts.length === 1)
    t.assert(body.date)
    test.done()
  })
}

exports.getEntitiesForLocationLimited = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      links: {
        active: [ 
          { type:util.statics.typeProximity, schema:util.statics.schemaPlace, links: true, limit: 3 }, 
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
        linkTypes: [util.statics.typeCreate], 
        direction: 'out',
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === util.statics.optionsLimitDefault)
    t.assert(body.more === true)
    test.done()
  })
}

exports.getEntitiesCreatedByUserPostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.uid1,
      cursor: { 
        linkTypes: [util.statics.typeCreate], 
        schemas: [util.statics.schemaPost], 
        direction: 'out',
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === util.statics.optionsLimitDefault)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0] && body.data[0].schema === util.statics.schemaPost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      cursor: { 
        linkTypes: [util.statics.typeContent], 
        schemas: [util.statics.schemaPost],
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === dbProfile.spe)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0] && body.data[0].schema === util.statics.schemaPost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimited = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      cursor: { 
        linkTypes: [util.statics.typeContent], 
        schemas: [util.statics.schemaPost],
        sort: { name: 1 },
        limit: 3,
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === util.statics.schemaPost)
    t.assert(body.data[0].name.indexOf('Lisa 1') > 0)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimitedAndSkip = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      cursor: { 
        linkTypes: [util.statics.typeContent], 
        schemas: [util.statics.schemaPost],
        sort: { name: 1 },
        limit: 3,
        skip: 2
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === util.statics.schemaPost)
    t.assert(body.data[0].name.indexOf('Lisa 3') > 0)
    test.done()
  })
}

exports.getUserMinimum = function (test) {
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
    test.done()
  })
}

