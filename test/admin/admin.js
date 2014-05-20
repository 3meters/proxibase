/**
 *  Proxibase admin tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var userSession
var userCred
var adminSession
var adminCred
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}


exports.validate = function(test) {
  t.get('/admin/validate?' + adminCred,
  function(err, res, body) {
    t.assert(body.results)
    t.assert(body.schemaErrors)
    t.assert(body.schemaErrors.length === 0)
    test.done()
  })
}

exports.gclinks = function(test) {
  var goodLink = {
    _id: 'li.goodlink',
    _from: uid1,
    _to: uid2,
    type: 'watch',
    _fromSchema: 'user',
    _toSchema: 'user',
  }
  var badLink1 = {
    _id: 'li.badLink1',
    _from: uid1,
    _to: uid2,
    type: 'like',
    _fromSchema: 'BOGUS_FROM_SCHEMA',
    _toSchema: 'user',
  }
  var badLink2 = {
    _id: 'li.badLink2',
    _from: uid1,
    _to: 'BOGUS_TO',
    type: 'follow',
    _fromSchema: 'user',
    _toSchema: 'user',
  }
  util.db.links.insert([goodLink, badLink1, badLink2], function(err, count) {
    t.assert(3 === count)
    test.done()
  })
}
