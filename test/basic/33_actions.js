/*
 *  Proxibase action tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var userId
var userCred
var adminId
var adminCred
var _exports = {} // for commenting out tests


var testPatch = {
  _id : "pa.111111.11111.111.212121",
  schema : util.statics.schemaPatch,
  name : "Testing patch for actions",
}


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userId = session._owner
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminId = session._owner
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.actionStatsWork = function(test) {
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {entity: testPatch},
  }, 201, function(err, res, body) {
    t.get('/actions/user_events/' + userId,
    function(err, res, body) {
      t.assert(body.data.length)
      body.data.forEach(function(action) {
        t.assert(action.event)
        t.assert(action.countBy)
      })
      cleanup(function(err, res, body) {
        test.done()
      })
    })
  })
}

function cleanup(cb) {
  t.del({uri: '/data/patches/' + testPatch._id + '?' + userCred}, cb)
}
