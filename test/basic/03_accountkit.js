/**
 *  Proxibase facebook account kit authencation test
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var adminCred
var userCred
var _user
var userOldCred
var session = {}
var adminSession = {}
var _exports = {}                    // for commenting out tests

var testUser = {
  name: 'AkTestUser',
  type: 'user',
}
var newUser
var newUserId



exports.userCanSignInWithAccountKit = function(test) {
  return skip(test)
  t.post({
    uri: '/auth/ak/',
    body: {email: testUser.email, password: testUser.password}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    t.assert(body.user.email)
    t.assert(body.user.role && body.user.role === 'user')
    t.assert(body.session)
    session = body.session
    userCred = 'user=' + body.session._owner + '&session=' + body.session.key
    userCred = qs.stringify(body.credentials)
    _user = body.session._owner
    test.done()
  })
}


exports.canValidateSession = function(test) {
  return skip(test)
  t.get({
    uri: '/data/patches?user=' + session._owner + '&session=' + session.key
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user._id === testUser._id)
    t.assert(body.user.name === testUser.name)
    test.done()
  })
}


exports.changingEmailResetsValidationAndNotifyDates = function(test) {
  return skip(test)
  var start = util.now()
  t.post({
    uri: '/data/users/' + newUserId + '?' + adminCred,
    body: {data: {email: 'authtest4@3meters.com'}}
  }, function(err, res, body) {
    var user = body.data
    t.assert(user.validationNotifyDate >= start)
    t.assert(!body.data.validationDate)
    test.done()
  })
}


exports.userCanSignOut = function(test) {
  return skip(test)
  t.get('/auth/signout?' + userCred,
  function(err, res, body) {
    t.get('/data/users?' + userCred, 401,
    function(err, res, body) {

      // Confirm session deleted
      t.get('/data/sessions?q[_owner]=' + _user + '&' + adminCred,
      function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}

// Supported
exports.userCanSignInWithLinked = function(test) {
  return skip(test)
  t.post({
    uri: '/auth/signin',
    body: {
      email: 'authtest4@3meters.com',
      password: 'foobar',
      linked: [{to: 'users', type: 'like', linkFields: '_to,_from,type'}],
    }
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.credentials)
    t.assert(body.user)
    t.assert(body.user._id === newUser._id)
    t.assert(body.user.linked)
    t.assert(body.user.linked.length === 1)
    var linked = body.user.linked[0]
    t.assert(linked._id === body.user._id)
    t.assert(linked.link)
    t.assert(linked.link._to === body.user._id)
    t.assert(linked.link._from === body.user._id)
    t.assert(linked.link.type === 'like')
    test.done()
  })
}
