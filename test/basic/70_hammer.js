/**
 * test/hammer.js
 *    performance and stress test
 */

var util = require('proxutils')
var statics = util.statics
var constants = require('../constants')
var dbProfile = constants.dbProfile.perfTest
var log = util.log
var serviceUri = util.config.service.uri
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user = {}
var userCred
var admin = util.adminUser
var adminCred
var _exports = {} // for commenting out tests


exports.makeUsers = function(test) {
  testUtil.getUserSession(function(session, sessionUser) {
    user = sessionUser
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.getEntities1 = function(test) {
  t.post({
    uri: '/do/getEntities?' + userCred,
    body: {
      entityIds: [constants.placeId],
      links: {
        active: [
          { type:statics.typeProximity, schema:statics.schemaBeacon, links: true, count: true, direction: 'both' }, 
          { type:statics.typeContent, schema:statics.schemaApplink, links: true, count: true, direction: 'both' }, 
          { type:statics.typeContent, schema:statics.schemaComment, links: true, count: true, direction: 'both' }, 
          { type:statics.typeContent, schema:statics.schemaPost, links: true, count: true, direction: 'both' }, 
          { type:statics.typeWatch, schema:statics.schemaUser, links: true, count: true, direction: 'both' }, 
          { type:statics.typeLike, schema:statics.schemaUser, links: true, count: true, direction: 'both' }, 
        ]},
    }
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data[0])
    var record = body.data[0]
    t.assert(record.linksIn && record.linksIn.length)
    // t.assert(record.linksIn && record.linksIn.length === dbProfile.spe + dbProfile.cpe + dbProfile.ape + dbProfile.likes + dbProfile.watch)
    t.assert(record.linksOut && record.linksOut.length === 1)
    t.assert(record.linksInCounts && record.linksInCounts.length === 5)
    t.assert(record.linksOutCounts && record.linksOutCounts.length === 1)
    test.done()
  })
}


