/**
 *  Private places tests
 */

var util = require('proxutils')
var log = util.log
var seed = util.seed(4)  // for running tests concurrently
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.safeDb   // raw mongodb connection object without mongoSafe wrapper
var adminUserId
var userSession
var userCred
var adminSession
var adminCred

var _exports = {}  // For commenting out tests

var tarzan = {
  name: 'tarzan' + seed,
  email: 'tarzan' + seed + '@3meters.com',
  password: 'foobar',
}

var jane = {
  name: 'jane' + seed,
  email: 'jane' + seed + '@3meters.com',
  password: 'foobar',
}

var mary = {
  name: 'mary' + seed,
  email: 'mary' + seed + '@3meters.com',
  password: 'foobar',
}

var river = {
  _id: 'pl.river' + seed,
  name: 'River' + seed,
}

var treehouse = {
  _id: 'pl.treehouse' + seed,
  name: 'Treehouse' + seed,
  visibility: 'private',
}

var janehouse = {
  _id: 'pl.janehouse' + seed,
  name: 'Janehouse' + seed,
  visibility: 'private',
}

var maryhouse = {
  _id: 'pl.maryhouse' + seed,
  name: 'Maryhouse' + seed,
  visibility: 'hidden',
}


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUserId = session._owner
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
      adminUserId = session._owner
    test.done()
    })
  })
}

exports.createUsers = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: tarzan,
      secret: 'larissa',
      installId: seed,
    }
  }, function(err, res, body) {
    t.assert(body.user && body.user._id)
    tarzan._id = body.user._id
    tarzan.role = body.user.role
    t.assert(body.session && body.session.key)
    tarzan.cred = 'user=' + tarzan._id + '&session=' + body.session.key
    t.post({
      uri: '/user/create',
      body: {
        data: jane,
        secret: 'larissa',
        installId: seed,
      }
    }, function(err, res, body) {
      t.assert(body.user && body.user._id)
      jane._id = body.user._id
      jane.role = body.user.role
      t.assert(body.session && body.session.key)
      jane.cred = 'user=' + jane._id + '&session=' + body.session.key
      t.post({
        uri: '/user/create',
        body: {
          data: mary,
          secret: 'larissa',
          installId: seed,
        }
      }, function(err, res, body) {
        t.assert(body.user && body.user._id)
        mary._id = body.user._id
        mary.role = body.user.role
        t.assert(body.session && body.session.key)
        mary.cred = 'user=' + mary._id + '&session=' + body.session.key
        test.done()
      })
    })
  })
}

exports.createPlaces = function(test) {
  t.post({
    uri: '/data/places?' + tarzan.cred,
    body: {data: river},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data.visibility === 'public')  // proves default
    t.post({
      uri: '/data/places?' + tarzan.cred,
      body: {data: treehouse},
    }, 201, function (err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data.visibility === 'private')
      t.post({
        uri: '/data/places?' + jane.cred,
        body: {data: janehouse},
      }, 201, function (err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data.visibility === 'private')
        t.post({
          uri: '/data/places?' + mary.cred,
          body: {data: maryhouse},
        }, 201, function (err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data.visibility === 'hidden')
          test.done()
        })
      })
    })
  })
}


exports.tarzanSendsMessageToPublicPlaceRiver = function(test) {
  t.post({
    uri: '/do/insertEntity?' + tarzan.cred,
    body: {
      entity: {
        schema: 'message',
        _id: 'me.tarzanToRiver' + seed,
        description: 'Good water, bad crocs',
      },
      links: [{
        _to: river._id,
        type: 'content',
      }]
    },
  }, 201, function(err, body, data) {
    test.done()
  })
}


exports.readMessage = function(test) {
  t.get('/find/messages/me.tarzanToRiver' + seed,
  function(err, res, body) {
    t.assert(body.count === 0)
    t.get('/find/messages/me.tarzanToRiver' + seed + '?' + tarzan.cred,
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}
