/**
 *  Proxibase auth validation test
 *    requires network connectivity because creating users
 *    likes to send mail, and if the mailer fails, errors
 *    bubble up to the test harness in unpredicatable ways
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var adminCred
var userCred
var userOldCred
var session = {}
var adminSession = {}
var _exports = {}                    // for commenting out tests
var testUser = {
  name: 'AuthValidationTestUser',
  email: 'authvaltest@3meters.com',
  password: 'foobar'
}
var newUserId
var newUserEmail
var newUserEmailValidateUrl
var notifyDate
var validationDate

exports.canSignInAsAdmin = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {user: {email: 'admin', password:'admin'}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    adminSession = body.session
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}

exports.adminCanAddUserViaRest = function(test) {
  t.post({
    uri: '/data/users?' + adminCred,
    body: {data: testUser}
  }, 201, function(err, res, body) {
    var user = body.data
    t.assert(user._id)
    t.assert(user.email === testUser.email)
    t.assert(user.validationNotifyDate)
    notifyDate = user.validationNotifyDate
    t.assert(!user.validationDate)
    testUser._id = user._id
    test.done()
  })
}

exports.adminCannotChangeValidateDateViaRest = function(test) {
  t.post({
    uri: '/data/users/' + testUser._id + '?' + adminCred,
    body: {data: {validationDate: util.getTimeUTC()}}
  }, 403, function(err, res, body) {
    t.assert(body.error.code === 403.22)
    test.done()
  })
}

exports.annonymousUserCanCreateUserViaApi = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/user/create',
    body: {
      data: {
        name: 'AuthValidationTestUser2',
        email: 'authvaltest2@3meters.com',
        password: 'foobar'
      },
      secret: 'larissa'
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.user.validateEmailUrl)
    t.assert(body.user.validationNotifyDate)
    t.assert(!body.user.validationDate)
    newUserId = body.user._id
    notifyDate = body.user.validationNotifyDate
    newUserEmailValidateUrl = body.user.validateEmailUrl
    t.assert(body.session)
    test.done()
  })
}


_exports.newUserEmailValidateUrlWorksSlowly = function(test) {
  t.get('/data/users/' + newUserId, function(err, res, body) {
    t.assert(body.data.length)
    t.assert(body.data[0].validationNotifyDate)
    t.assert(!body.data[0].validationDate)
    t.get({
      uri: newUserEmailValidateUrl.slice(testUtil.serverUrl.length),
      json: false  // call is redirected to an html page
    }, function(err, res, body) {
      t.get('/data/users/' + newUserId, function(err, res, body) {
        t.assert(body.data.length)
        t.assert(body.data[0].validationDate)
        t.assert(body.data[0].validationDate > body.data[0].validationNotifyDate)
        test.done()
      })
    })
  })
}

exports.newUserEmailValidateUrlWorksFaster = function(test) {
  if (disconnected) return skip(test)
  t.get('/data/users/' + newUserId, function(err, res, body) {
    t.assert(body.data.length)
    t.assert(body.data[0].validationNotifyDate)
    t.assert(!body.data[0].validationDate)

    // Fire without waiting for the callback
    t.get(newUserEmailValidateUrl.slice(testUtil.serverUrl.length))

    // Give time for the update to finish, but don't wait for the
    // call to redirect the user to http://aircandi.com
    setTimeout(function() {
      t.get('/data/users/' + newUserId, function(err, res, body) {
        t.assert(body.data.length)
        t.assert(body.data[0].validationDate)
        t.assert(body.data[0].validationDate > body.data[0].validationNotifyDate)
        test.done()
      })
    }, 300)
  })
}

exports.changingEmailResetsValidationAndNotifyDates = function(test) {
  if (disconnected) return skip(test)
  var start = util.now()
  t.post({
    uri: '/data/users/' + newUserId + '?' + adminCred,
    body: {data: {email: 'authvaltest4@3meters.com'}}
  }, function(err, res, body) {
    var user = body.data
    t.assert(user.validationNotifyDate >= start)
    t.assert(!body.data.validationDate)
    test.done()
  })
}


exports.reqValidateFailsForUsers = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/user/reqvalidate?' + userCred,
    body: {user: {_id: newUserId}}
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.reqValidateWorksForAdmins = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/user/reqvalidate?' + adminCred,
    body: {user: {_id: newUserId}}
  }, function(err, res, body) {
    t.assert(body.info)
    test.done()
  })
}

