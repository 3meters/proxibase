/*
 *  Proxibase rest basic test
 */

var
  assert = require('assert'),
  request = require('request'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  testUser1 = {
    _id: "testId1",
    name: "Test User1",
    email: "foo@bar.com"
  },
  testUserGenId = {
    name: "Test User GenId",
    email: "foo@bar.com"
  }


// Delete first in case old test left data around
exports.delUsers = function delUsers(test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/users/ids:testId1,testId2'
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.postWithMissingDataTag = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = '{"name":"ForgotToEncloseDataInDataTag"}'
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}

exports.postWithMultipleArrayElements = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({
    data: [
      {
        name: "TestUser0",
        email: "foo@bar.com"
      },{
        name: "TestUser1",
        email: "foo@bar.com"
      }
    ]
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}

exports.addBadUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:{_id:'testIdBad',name:'Bad User Without Email'}})
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}

exports.addUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:testUser1})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id && res.body.data._id === testUser1._id, dump(req, res))
    test.done()
  })
}

exports.checkUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0].name && res.body.data[0].name === testUser1.name, dump(req, res))
    test.done()
  })
}

exports.updateUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + testUser1._id
  req.body = '{"data":{"name":"Test User2"}}'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1)
    assert(res.body.data && res.body.data.name && res.body.data.name === 'Test User2', dump(req, res))
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].name === 'Test User2', dump(req, res))
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/users/ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkUpdatedUserDeleted = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUser1._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.updateNonExistantUser = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:bogus'
  req.body = '{"data":{"name":"Test User Bogus"}}'
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}

exports.addUserWithoutId = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:testUserGenId})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    testUserGenId._id = res.body.data._id
    test.done()
  })
}

exports.getUserFromGeneratedId = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUserGenId._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1 &&
      res.body.data && res.body.data.length === 1,
      dump(req, res))
    test.done()
  })
}

exports.deleteUserWithGeneratedId = function(test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/users/ids:' + testUserGenId._id
  request(req, function(err, res){
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkUserWithGeneratedIdGone = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUserGenId._id
  request(req, function(err, res){
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}
