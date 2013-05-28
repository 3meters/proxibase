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
      entityIds: [constants.entityId], 
      entityType: 'entities',
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
      entityIds: [constants.entityId], 
      entityType: 'entities',
      activeLinks: [ 
        { type:util.statics.typeProximity, load: true, links: true, count: true, direction: 'both' }, 
        { type:util.statics.typeApplink, load: true, links: true, count: true, direction: 'both' }, 
        { type:util.statics.typeComment, load: true, links: true, count: true, direction: 'both' }, 
        { type:util.statics.typePost, load: true, links: true, count: true, direction: 'both' }, 
        { type:util.statics.typeWatch, load: true, links: true, count: true, direction: 'both' }, 
        { type:util.statics.typeLike, load: true, links: true, count: true, direction: 'both' }, 
      ]
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + dbProfile.watch)
    t.assert(record.linksOut && record.linksOut.length === 1)
    t.assert(record.linkInCounts && record.linkInCounts.length === 5)
    t.assert(record.linkOutCounts && record.linkOutCounts.length === 1)
    t.assert(record.entities && record.entities.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + 1)
    t.assert(record.users && record.users.length === dbProfile.likes)
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
      entityIds: [constants.entityId], 
      entityType: 'entities',
      activeLinks: [ 
        { type:util.statics.typeComment, load: true, links: false, count: false }, 
      ]
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(!record.linkInCounts && !record.linkOutCounts)
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
      entityIds: [constants.entityId], 
      entityType: 'entities',
      activeLinks: [ 
        { type:util.statics.typeComment, load: true, links: false, count: false }, 
        { type:util.statics.typeProximity }, 
        { type:util.statics.typeApplink }, 
        { type:util.statics.typeComment }, 
        { type:util.statics.typePost }, 
        { type:util.statics.typeWatch }, 
        { type:util.statics.typeLike }, 
      ]
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linkInCounts && record.linkInCounts.length === 5)
    t.assert(record.linkOutCounts && record.linkOutCounts.length === 1)
    t.assert(!record.linksIn && !record.linksOut)
    t.assert(record.entities && record.entities.length === dbProfile.cpe)
    test.done()
  })
}

exports.getEntitiesForLocation = function (test) {
  t.post({
    uri: '/do/getEntities',
    body: {
      entityIds: [constants.beaconId],
      entityType: 'entities',
      activeLinks: [ 
        { type:util.statics.typeProximity, load: true }, 
      ]
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
      activeLinks: [ 
        { type:util.statics.typeProximity, load: true, limit: 3 }, 
      ]
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
    uri: '/do/getEntitiesForUser',
    body: {
      userId: constants.uid1
    }
  }, function(err, res, body) {
    t.assert(body.count === util.statics.optionsLimitDefault)
    t.assert(body.more === true)
    test.done()
  })
}


