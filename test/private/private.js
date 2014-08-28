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
  _id: 'us.tarzan' + seed,
  name: 'tarzan' + seed,
  email: 'tarzan' + seed + '@3meters.com',
  password: 'foobar',
}

var jane = {
  _id: 'us.jane' + seed,
  name: 'jane' + seed,
  email: 'jane' + seed + '@3meters.com',
  password: 'foobar',
}

var mary = {
  _id: 'us.mary' + seed,
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

exports.tarzanWatchesRiver = function(test) {
  t.post({
    uri: '/data/links?' + tarzan.cred,
    body: {data: {
      _to: river._id,
      _from: tarzan._id,
      type: 'watch',
    }},
  }, 201, function(err, res, body) {
    test.done()
  })
}

exports.tarzanSendsMessageToRiver = function(test) {
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


exports.tarzanSendsMessageToTreehouse = function(test) {
  t.post({
    uri: '/do/insertEntity?' + tarzan.cred,
    body: {
      entity: {
        schema: 'message',
        _id: 'me.tarzanToTreehouse' + seed,
        description: 'Check out my hammock',
      },
      links: [{
        _to: treehouse._id,
        type: 'content',
      }]
    },
  }, 201, function(err, body, data) {
    test.done()
  })
}


exports.janeSendsMessageToJanehouse = function(test) {
  t.post({
    uri: '/do/insertEntity?' + jane.cred,
    body: {
      entity: {
        schema: 'message',
        _id: 'me.janeToJanehouse' + seed,
        description: 'Checkout my bed',
      },
      links: [{
        _to: janehouse._id,
        type: 'content',
      }]
    },
  }, 201, function(err, body, data) {
    test.done()
  })
}


exports.tarzanSendsMessageToJanehouseAndFails = function(test) {
  t.post({
    uri: '/do/insertEntity?' + tarzan.cred,
    body: {
      entity: {
        schema: 'message',
        _id: 'me.tarzanToJanehouse' + seed,
        description: 'What is bed?',
      },
      links: [{
        _to: janehouse._id,
        type: 'content',
      }]
    },
  }, 401, function(err, body, data) {
    test.done()
  })
}



exports.messagesAreOwnerAccess = function(test) {
  t.get('/find/messages/me.tarzanToRiver' + seed,
  function(err, res, body) {
    t.assert(body.count === 0)
    t.get('/find/messages/me.tarzanToRiver' + seed + '?' + tarzan.cred,
    function(err, res, body) {
      t.assert(body.count === 1)
      t.get('/find/messages/me.tarzanToRiver' + seed + '?' + jane.cred,
      function(err, res, body) {
        t.assert(body.count === 0)
        test.done()
      })
    })
  })
}


exports.getEntsForEntsDoesNotExposePrivateFieldsOfWatchers = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: 'pl.river' + seed,
      cursor: {
        linkTypes: ['watch'],
        direction: 'in',
      },
    },
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data.length === 1)
    t.assert(body.data[0]._id === tarzan._id)
    t.assert(!body.data.email)
    test.done()
  })
}


exports.getEntitiesForEntsReadsMessagesToPublicPlaces = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: 'pl.river' + seed,
      cursor: {
        linkTypes: ['content'],
        direction: 'in',
      },
    },
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data[0].description === 'Good water, bad crocs')
    test.done()
  })
}

exports.tarzanInvitesJaneToTreehouse = function(test) {
  t.post({
    uri: '/data/messages?' + tarzan.cred,
    body: {data: {
      _id: 'me.tarzanInvite' + seed,
      description: 'Check out my treehouse'
    }},
  }, 201, function(err, res, body) {
    t.post({
      uri: '/data/links?' + tarzan.cred,
      body: {data: {
        _id: 'li.toJaneFromTarzanInvite' + seed,
        _to: jane._id,
        _from: 'me.tarzanInvite' + seed,
        type: 'share',
      }}
    }, 201, function(err, res, body) {
      t.assert(body.data._owner === jane._id)
      t.post({
        uri: '/data/links?' + tarzan.cred,
        body: {data: {
          _id: 'li.toTreehouseFromTarzanInvite' + seed,
          _to: treehouse._id,
          _from: 'me.tarzanInvite' + seed,
          type: 'share',
        }}
      }, 201, function(err, res, body) {
        t.assert(body.data._owner === tarzan._id)
        test.done()
      })
    })
  })
}

exports.tarzanRequestsToWatchJanesHouse = function(test) {
  t.post({
    uri: '/data/links?' + tarzan.cred,
    body: {data: {
      _from: tarzan._id,
      _to: janehouse._id,
      type: 'watch',
    }}
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(jane._id === body.data._owner)
    t.assert(body.data.enabled === false)
  })
}
