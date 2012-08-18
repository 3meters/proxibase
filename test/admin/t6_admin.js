/*
 *  Proxibase admin tests
 *
 */

var
  assert = require('assert'),
  request = require('request'),
  util = require('../../lib/util'),
  log = util.log,
  testUtil = require('../util'),
  Req = testUtil.Req,
  check = testUtil.check,
  dump = testUtil.dump,
  userSession,
  userCred,
  adminSession,
  adminCred,
  _exports = {}  // For commenting out tests


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

exports.sendEmailValidationNotification = function(test) {
  var req = new Req({
    uri: '/admin/valemail?' + adminCred,
    body: {user: {
      email: 'test@3meters.com'
    }}
  })
  request(req, function(err, res){
    check(req, res, 404)
    test.done()
  })
}


