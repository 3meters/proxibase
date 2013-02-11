/**
 *  Proxibase admin tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
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

exports.findOrphansAsAnnonFails = function(test) {
  t.get('/admin/findorphans', 401,
  function(err, res, body){
    test.done()
  })
}

exports.findOrphansAsUserFails = function(test) {
  t.get('/admin/findorphans?' + userCred, 401,
  function(err, res, body){
    test.done()
  })
}

exports.findOrphansAsAdminWorks = function(test) {
  t.get('/admin/findorphans?' + adminCred,
  function(err, res, body){
    t.assert(body.report)
    test.done()
  })
}
