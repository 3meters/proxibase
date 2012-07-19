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
  str = JSON.stringify,
  adminCreds = '',
  userCreds = '',
  user1 = {
    name: 'Auth Test User 1',
    email: 'authTestUser1@bar.com'
  },
  user2 = {
    name: 'Auth Test User 2',
    email: 'authTESTuser1@bar.com',  // duplicate email on purpose
    password: 'foobarfoobar'
  },
  session = {},
  _exports = {},                    // for commenting out tests
  log = require('../../lib/util').log


exports.addUserNotLoggedIn = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = JSON.stringify({data:{email:'foo@bar.com', password:'foobarfoo'}})
  request(req, function(err, res) {
    check(req, res, 401)
    test.done()
  })
}


exports.loginAsAdmin = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = str({ user: { email: 'admin', password: 'admin' }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    // These credentials will be useds in subsequent tests
    adminCreds = 'user=' + res.body.user._id + '&session=' + res.body.session.key
    test.done()
  })
}


exports.addUserWithoutEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = JSON.stringify({ data:{ name: 'MrMissingEmail', password: 'foobarfoo' }})
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1, dump(req, res))
    test.done()
  })
}


exports.addUserWithoutPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.21)
    test.done()
  })
}


exports.addUserWithTooWeakPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  user1.password = 'foo'
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.21)
    test.done()
  })
}


exports.addUser = function(test) {
  user1.password = 'foobar'
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = JSON.stringify({data:user1})
  request(req, function(err, res) {
    check(req, res, 201)
    assert(res.body.data._id)
    user1._id = res.body.data._id
    test.done()
  })
}


exports.addUserWithDupeEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users?' + adminCreds
  req.body = JSON.stringify({data:user2})
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.1)
    test.done()
  })
}


exports.signinWrongFields = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({
    user: {
      name: 'Not a user',
      password: 'password'
    }
  })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error.code === 400.1)
    test.done()
  })
}


exports.signinBadEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user: {
    email: 'billy@notHere',
    password: 'wrong'
  }})
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.signinBadPassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user: {
    email: user1.email,
    password: 'wrong'
  }})
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.signinValid = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user:{
    email: user1.email,
    password: user1.password
  }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    assert(res.body.user.email)
    assert(res.body.user.role && res.body.user.role === 'user')
    assert(res.body.session)
    session = res.body.session
    userCreds = 'user=' + res.body.session._owner + '&session=' + res.body.session.key
    test.done()
  })
}


exports.newUserCanUpdateOwnRecord = function (test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + session._owner + '?' + userCreds
  req.body = str({data: {location: 'Orlando'}})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.session)
    assert(res.body.user.location === 'Orlando')
    test.done()
  })
}


exports.signinMixedCaseEmail = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/signin'
  req.body = JSON.stringify({user:{
    email: user1.email.toUpperCase(),
    password: user1.password
  }})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.user)
    assert(res.body.user._id === user1._id)
    assert(res.body.user.name === user1.name)
    assert(res.body.user.email)
    assert(res.body.session)
    test.done()
  })
}


exports.validateSessionBadUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users?user=bogus&session=' + session.key
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
    test.done()
  })
}


exports.validateSessionBadKey = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users?user=' + session._owner + '&session=bogus'
  request(req, function(err, res) {
    check(req, res, 401)
    assert(res.body.error.code === 401.1)
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
    assert(res.body.session)
    assert(res.body.session.key === session.key)
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
    assert(res.body.session)
    assert(res.body.session.key === session.key)
    test.done()
  })
}


exports.adminCannotChangePasswordDirectly = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + user1._id + '?' + adminCreds
  req.body = str({ data: { password: 'newpass' } })
  request(req, function(err, res) {
    check(req, res, 403)  // forbidden
    assert(res.body.error.code === 403.22)
    test.done()
  })
}


exports.userCannotChangePasswordTooWeak = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/changepw?' + userCreds
  req.body = JSON.stringify({
    user: {
      _id: user1._id,
      oldPassword: user1.password,
      newPassword: 'password'
    }
  })
  request(req, function(err, res) {
    check(req, res, 403)
    assert(res.body.error.code === 403.21)
    test.done()
  })
}

exports.userChangePassword = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/auth/changepw?' + userCreds
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

