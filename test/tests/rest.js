/*
 *  Proxibase rest basic test
 */

var
  request = require('request'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.getBaseUri(),
  req = testUtil.getDefaultReq(),
  testUser1 = {
    _id: "testId1",
    name: "Test User1",
    email: "foo@bar.com"
  }

// make sure the server is responding
exports.getUsers = function (test) {
  req.method = 'get'
  req.uri = baseUri
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function delUsers2(test) {
  req.method = 'delete'
  req.uri = baseUri + '/users/__ids:testId1,testId2'
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.postWithMissingBody = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users'
  delete req.body
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error)
    test.done()
  })
}

exports.postWithBadJsonInBody = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users'
  req.body = '{data: "This is not JSON"}'
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error)
    test.done()
  })
}

exports.postWithMissingDataTag = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users'
  req.body = '{"name":"ForgotToEncloseDataInDataTag"}'
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error)
    test.done()
  })
}

exports.postWithMultipleArrayElements = function(test) {
  test.done()
}

exports.addBadUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users'
  req.body = JSON.stringify({data:{_id:'testIdBad',name:'Bad User Without Email'}})
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error)
    test.done()
  })
}

exports.addUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users'
  req.body = JSON.stringify({data:testUser1})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data._id && res.body.data._id === testUser1._id)
    test.done()
  })
}

exports.checkUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/users/__ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0].name && res.body.data[0].name === testUser1.name)
    test.done()
  })
}

exports.updateUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/users/__ids:' + testUser1._id
  req.body = '{"data":{"name":"Test User2"}}'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data.name && res.body.data.name === 'Test User2')
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/users/__ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].name === 'Test User2')
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.method = 'delete'
  req.uri = baseUri + '/users/__ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUserDeleted = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/users/__ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0)
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
