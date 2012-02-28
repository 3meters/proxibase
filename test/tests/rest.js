/*
 *  Proxibase rest test
 */

var
  req = require('request'),
  log = require('../../lib/util').log,
  uri = require('../util').getBaseUri() + '/users',
  check = require('../util').check,
  getOptions = require('../util').getOptions,
  testUser1 = {
    _id: "testId1",
    name: "Test User1",
    email: "foo@bar.com"
  }

// make sure the server is alive
exports.getUsers = function (test) {
  req.get(uri, function(err, res) {
    check(res, test)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function delUsers2(test) {
  req.del(uri + '/__ids:testId1,testId2', function(err, res) {
    check(res, test)
    test.done()
  })
}

exports.postWithMissingBody = function(test) {
  var options = getOptions('users')
  req.post(options, function(err, res) {
    check(res, test, 400)
    test.ok(res.body.error)
    test.done()
  })
}

exports.postWithBadJsonInBody = function(test) {
  var options = getOptions('users', {name: "Test UserBad"})
  options.body = '{data: "This is not JSON"}'
  req.post(options, function(err, res) {
    check(res, test, 400)
    test.ok(res.body.error)
    test.done()
  })
}

exports.postWithMissingDataTag = function(test) {
  var options = getOptions('users', { name: "Test UserBad" })
  req.post(options, function(err, res) {
    check(res, test, 400)
    test.ok(res.body.error)
    test.done()
  })
}

exports.postWithMultipleArrayElements = function(test) {
  test.done()
}

exports.addBadUser = function(test) {
  var options = getOptions('users', {data: { _id: 'testIdBad', name: 'Bad User Without Email'} })
  req.post(options, function(err, res) {
    check(res, test, 400)
    test.ok(res.body.error)
    test.done()
  })
}

exports.addUser = function(test) {
  var options = getOptions('users', { data: testUser1 })
  req.post(options, function(err, res) {
    check(res, test)
    test.ok(res.body.count === 1)
    test.ok(res.body.data && res.body.data._id && res.body.data._id === testUser1._id)
    test.done()
  })
}

exports.checkUser = function(test) {
  req.get(uri + '/__ids:' + testUser1._id, function(err, res) {
    check(res, test)
    test.ok(res.body.data && res.body.data[0].name && res.body.data[0].name === testUser1.name)
    test.done()
  })
}

exports.updateUser = function(test) {
  var options = getOptions('users/__ids:' + testUser1._id, {data: { name: 'Test User2' } })
  req.post(options, function(err, res) {
    check(res, test)
    test.ok(res.body.count === 1)
    test.ok(res.body.data && res.body.data.name && res.body.data.name === 'Test User2')
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.get(uri + '/__ids:' + testUser1._id, function(err, res) {
    check(res, test)
    test.ok(res.body.data && res.body.data[0] && res.body.data[0].name === 'Test User2')
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.del(uri + '/__ids:' + testUser1._id, function(err, res) {
    check(res, test)
    test.ok(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUserDeleted = function(test) {
  req.get(uri + '/__ids:' + testUser1._id, function(err, res) {
    check(res, test)
    test.ok(res.body.count === 0)
    test.done()
  })
}

exports.addUserWithoutId = function(test) {
  test.done()
}

exports.getUserFromGeneratedId = function(test) {
  test.done()
}

exports.deleteUserWithGeneratedId = function(test) {
  test.done()
}

exports.checkUserWithGeneratedIdGone = function(test) {
  test.done()
} 
