/*
 *  Proxibase basic authencation test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  user1 = {
    name: 'Auth Test User 1',
    email: 'authTestUser1@bar.com'
  },
  user2 = {
    name: 'Auth Test User 2',
    email: 'uathTestUser1@bar.com'  // duplicate email on purpose
  },
  session = {},
  log = require('../../lib/util').log


exports.addUserWithoutPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}


exports.addUserWithTooWeakPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  user1.password = 'foo'
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}


exports.addUser = function(test) {
  user1.password = 'foobar'
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data._id)
    user1._id = res.body.data._id
    test.done()
  })
}


exports.addUserWithDupeEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:user2})
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}


exports.signinBadUserName = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({
    user: {
      name: 'Not a user',
      password: 'password'
    }
  })
  request(req, function(err, res) {
    check(req, res, 404)
    test.done()
  })
}


exports.signinBadPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user: {
    name: 'Auth Test User 1',
    password: 'wrong'
  }})
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.signinValid = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user:{
    name: 'Auth Test User 1',
    password: 'foobar'
  }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    assert(res.body.session)
    session = res.body.session
    test.done()
  })
}


exports.signinMixedCaseName = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user:{
    name: 'auth TEST UsEr 1',
    password: 'foobar'
  }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    assert(res.body.session)
    test.done()
  })
}

exports.signinEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user:{
    name: 'authtestuser1@bar.com',
    password: 'foobar'
  }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    assert(res.body.session)
    test.done()
  })
}

exports.validateSessionBadUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users?user=bogus&session=' + session.key
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.validateSessionBadKey = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users?user=' + session._owner + '&session=bogus'
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.validateSession = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users?user=' + session._owner + '&session=' + session.key
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    test.done()
  })
}


exports.validateSessionParamsInBody = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/do/find'
  req.body = JSON.stringify({
    table:'users',
    user: session._owner,
    session: session.key
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    test.done()
  })
}


exports.cannotChangePasswordDirectly = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + user1._id
  req.body = JSON.stringify({
    data: {
      password: 'newpass'
    }
  })
  request(req, function(err, res) {
    check(req, res, 403)  // forbidden
    test.done()
  })
}

exports.changePasswordTooWeak = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/changepw'
  req.body = JSON.stringify({
    user: {
      _id: user1._id,
      oldPassword: user1.password,
      newPassword: 'password'
    }
  })
  request(req, function(err, res) {
    check(req, res, 400)
    test.done()
  })
}

exports.changePassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/changepw'
  req.body = JSON.stringify({
    user: {
      _id: user1._id,
      oldPassword: user1.password,
      newPassword: 'newpassword'
    }
  })
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

