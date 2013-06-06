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
var testUser = {
  _id : "0001.111111.11111.111.111111",
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
          { type:util.statics.typeProximity, load: true, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeApplink, load: true, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeComment, load: true, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typePost, load: true, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeWatch, load: true, links: true, count: true, direction: 'both' }, 
          { type:util.statics.typeLike, load: true, links: true, count: true, direction: 'both' }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + dbProfile.watch)
    t.assert(record.linksOut && record.linksOut.length === 1)
    t.assert(record.linksInCounts && record.linksInCounts.length === 5)
    t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
    t.assert(record.entities && record.entities.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + 1)
    test.done()
  })
}

exports.getEntitiesWithComments = function (test) {
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
          { type:util.statics.typeComment, load: true, links: false, count: false }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linksInCounts && !record.linksOutCounts)
    t.assert(record.entities && record.entities.length === dbProfile.cpe)
    test.done()
  })
}

exports.getEntitiesWithCommentsAndLinkCounts = function (test) {
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
          { type:util.statics.typeComment, load: true, links: false, count: false }, 
          { type:util.statics.typeProximity }, 
          { type:util.statics.typeApplink }, 
          { type:util.statics.typeComment }, 
          { type:util.statics.typePost }, 
          { type:util.statics.typeWatch }, 
          { type:util.statics.typeLike }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksInCounts && record.linksInCounts.length === 5)
    t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(record.entities && record.entities.length === dbProfile.cpe)
    test.done()
  })
}

exports.getEntitiesAndLinkedEntitiesByUser = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.placeId], 
      links: {
        where: { _creator: constants.uid1 },
        active: [ 
          { type:util.statics.typeComment, load: true, links: false, count: false }, 
          { type:util.statics.typePost, load: true, links: false, count: false }, 
          { type:util.statics.typeProximity }, 
          { type:util.statics.typeApplink }, 
          { type:util.statics.typeComment }, 
          { type:util.statics.typeWatch }, 
          { type:util.statics.typeLike }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.entities && record.entities.length === 2)
    t.assert(record.entities[0]._creator === constants.uid1)
    t.assert(record.entities[1]._creator === constants.uid1)
    test.done()
  })
}

exports.getEntitiesForLocation = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      entityType: 'entities',
      links: {
        active: [ 
          { type:util.statics.typeProximity, load: true }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.entities.length === dbProfile.epb)
    t.assert(body.date)
    test.done()
  })
}

exports.getEntitiesForLocationLimited = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      entityType: 'entities',
      links: {
        active: [ 
          { type:util.statics.typeProximity, load: true, limit: 3 }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.entities.length === 3)
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  t.post({
    uri: '/do/getEntitiesByOwner',
    body: {
      entityId: constants.uid1,
      entitySchemas: [util.statics.typePlace, util.statics.typePost],
    }
  }, function(err, res, body) {
    t.assert(body.count === util.statics.optionsLimitDefault * 2)
    t.assert(body.more === true)
    test.done()
  })
}

exports.getEntitiesForUserPostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesByOwner',
    body: {
      entityId: constants.uid1,
      entitySchemas: [util.statics.typePost],
    }
  }, function(err, res, body) {
    t.assert(body.count === util.statics.optionsLimitDefault)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0] && body.data[0].schema === util.statics.typePost)
    test.done()
  })
}

exports.getEntitiesForUserMatchingRegex = function (test) {
  t.post({
    uri: '/do/getEntitiesByOwner',
    body: {
      entityId: constants.uid1,
      entitySchemas: [util.statics.typePlace, util.statics.typePost],
      cursor: { where: { name: { $regex:'2401', $options:'i' }}},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0] && body.data[0].schema === util.statics.typePost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnly = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      linkTypes: [util.statics.typePost],
    }
  }, function(err, res, body) {
    t.assert(body.count === dbProfile.spe)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0] && body.data[0].schema === util.statics.typePost)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimited = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      linkTypes: [util.statics.typePost],
      cursor: { 
        sort: { name: 1 },
        limit: 3,
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === true)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === util.statics.typePost)
    t.assert(body.data[0].name.indexOf('Lisa 1') > 0)
    test.done()
  })
}

exports.getEntitiesForPlacePostsOnlyLimitedAndSkip = function (test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: constants.placeId, 
      linkTypes: [util.statics.typePost],
      cursor: { 
        sort: { name: 1 },
        limit: 3,
        skip: 2
      },
    }
  }, function(err, res, body) {
    t.assert(body.count === 3)
    t.assert(body.more === false)
    t.assert(body.data && body.data[0])
    t.assert(body.data[0].schema === util.statics.typePost)
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

