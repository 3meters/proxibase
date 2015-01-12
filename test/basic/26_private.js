/**
 *  Private patches tests
 */

var async = require('async')
var util = require('proxutils')
var seed = util.seed(6)  // for running tests concurrently
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
  _id: 'pa.river' + seed,
  name: 'River' + seed,
}

var treehouse = {
  _id: 'pa.treehouse' + seed,
  name: 'Treehouse' + seed,
  visibility: 'private',
}

var janehouse = {
  _id: 'pa.janehouse' + seed,
  name: 'Janehouse' + seed,
  visibility: 'private',
}

var maryhouse = {
  _id: 'pa.maryhouse' + seed,
  name: 'Maryhouse' + seed,
  visibility: 'hidden',
}


// Not needed by this test
_exports.getUserSession = function(test) {
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

exports.createPatches = function(test) {
  t.post({
    uri: '/data/patches?' + tarzan.cred,
    body: {data: river},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data.visibility === 'public')  // proves default
    t.post({
      uri: '/data/patches?' + tarzan.cred,
      body: {data: treehouse},
    }, 201, function (err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data.visibility === 'private')
      t.post({
        uri: '/data/patches?' + jane.cred,
        body: {data: janehouse},
      }, 201, function (err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data.visibility === 'private')
        test.done()
        // Hidden is currently NYI, skip
        /*
        t.post({
          uri: '/data/patches?' + mary.cred,
          body: {data: maryhouse},
        }, 201, function (err, res, body) {
          t.assert(body.count === 1)
          t.assert(body.data.visibility === 'hidden')
          test.done()
        })
        */
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
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
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
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._acl === treehouse._id)
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
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {
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
      }],
      returnNotifications: true,
    },
  }, 401, function(err, res, body) {
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
        t.assert(body.count === 1)  // river is public
        t.get('/find/messages/me.tarzanToTreehouse' + seed + '?' + tarzan.cred,
        function(err, res, body) {
          t.assert(body.count === 1)  // tarzan owns treehouse
          t.get('/find/messages/me.tarzanToTreehouse' + seed + '?' + jane.cred,
          function(err, res, body) {
            t.assert(body.count === 0)  // jane is not watching treehouse
            test.done()
          })
        })
      })
    })
  })
}


exports.getEntsForEntsDoesNotExposePrivateFieldsOfWatchers = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId:  river._id,
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

exports.findWithLinksDoesNotExposePrivateFieldsOfWatches = function(test) {
  t.post({
    uri: '/find/patches/' + river._id,
    body: {
      links: {
        from: 'users',
        filter: {type: 'watch'}
      }
    },
  }, function(err, res, body) {
    t.assert(body.data)
    var watchLinks = body.data.links.from.users
    t.assert(watchLinks.length)
    watchLinks.forEach(function(watchLink) {
      t.assert(watchLink.document)
      t.assert(watchLink.document.name)
      t.assert(!watchLink.document.email)
    })
    test.done()
  })
}

exports.getEntitiesForEntsReadsMessagesToPublicPatches = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: 'pa.river' + seed,
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


exports.tarzanCannotInviteHimselfToJanehouse = function(test) {
  t.post({
    uri: '/do/insertEntity?' + tarzan.cred,
    body: {
      entity: {
        _id: 'me.tarzanInvitesHimselfOver' + seed,
        schema: 'message',
        description: 'I would like to see Janehouse',
      },
      // insertEntity will set the _from side of the following links
      // to the entity._id of the message
      links: [{
        _id: 'li.toJaneFromTarzanSelfInvite' + seed,
        _to: jane._id,
        type: 'share',
      }, {
        _id: 'li.toJanehouseFromTarzanSelfInvite' + seed,
        _to: janehouse._id,
        type: 'share',
      }],
      returnNotifications: true,
    },
  }, 401, function(err, res, body) {
    t.get('/data/messages/me.tarzanInvitesHimselfOver' + seed + '?' + tarzan.cred,
    function(err, res, body) {
      // The message record exists due to partial failure of the previous call
      // TODO:  it should be 0, since setting the _acl field should fail
      t.assert(body.count === 1)
      t.get('/data/links/li.toJaneFromTarzanSelfInvite' + seed + '?' + tarzan.cred,
      function(err, res, body) {
        // The link to jane from the share message still exists.  Should it?
        t.assert(body.count === 1)
        t.get('/data/links/li.toJanehouseFromTarzanSelfInvite' + seed + '?' + tarzan.cred,
        function(err, res, body) {
          // This is the link failure that caused the 401 in the top-level call
          t.assert(body.count === 0)
          test.done()
        })
      })
    })
  })
}

var tarzanWatchesJanehouse = {
  _id: 'li.tarzanWatchesJaneHouse' + seed,
  _from: tarzan._id,
  _to: janehouse._id,
  type: 'watch',
}

exports.tarzanRequestsToWatchJanehouse = function(test) {
  t.post({
    uri: '/data/links?' + tarzan.cred,
    body: {data: tarzanWatchesJanehouse},
  }, 201, function(err, res, body) {
    t.assert(body.data)
    tarzanWatchesJanehouse = body.data
    t.assert(jane._id === tarzanWatchesJanehouse._owner)
    t.assert(tarzanWatchesJanehouse.enabled === false)
    test.done()
  })
}


exports.tarzanCannotReadJanesMessagesYet = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + tarzan.cred,
    body: {
      entityId: janehouse._id,
      cursor: {
        linkTypes: ['content'],
        direction: 'in',
      },
    },
  }, function(err, res, body) {
    t.assert(body.data.length === 0)
    test.done()
  })
}

exports.tarzanCannotReadJanesMessagesYetUsingRest = function(test) {
  t.post({
    uri: '/find/patches/' + janehouse._id + '?' + tarzan.cred,
    body: {
      links: {
        from: 'messages',
        filter: {type: 'messages'},
      }
    },
  }, function(err, res, body) {
    t.assert(body.data.links.from.messages.length === 0)
    test.done()
  })
}


exports.tarzanCannotAcceptHisOwnRequestOnJanesBehalf = function(test) {
  t.post({
    uri: '/data/links/' + tarzanWatchesJanehouse._id + '?' + tarzan.cred,
    body: {data: {enabled: true}},
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.janeAcceptsTarzansRequest = function(test) {
  t.post({
    uri: '/data/links/' + tarzanWatchesJanehouse._id + '?' + jane.cred,
    body: {data: {enabled: true}},
  }, function(err, res, body) {
    test.done()
  })
}

exports.tarzanCanNowReadMessagesToJanehouse = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + tarzan.cred,
    body: {
      entityId: janehouse._id,
      cursor: {
        linkTypes: ['content'],
        direction: 'in',
      },
    },
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    test.done()
  })
}

exports.tarzanCanNowReadMessagesToJanehouseViaRest = function(test) {
  t.post({
    uri: '/find/patches/' + janehouse._id + '?' + tarzan.cred,
    body: {
      links: {
        from: 'messages',
        filter: {type: 'content'}
      }
    },
  }, function(err, res, body) {
    t.assert(body.data.links.from.messages.length === 1)
    test.done()
  })
}

exports.tarzanInvitesJaneToTreehouse = function(test) {
  t.post({
    uri: '/do/insertEntity?' + tarzan.cred,
    body: {
      entity: {
        _id: 'me.tarzanInvite' + seed,
        schema: 'message',
        type: 'root',
        description: 'Check out my treehouse',
      },
      // insertEntity will set the _from side of the following links
      // to the entity._id of the message
      links: [{
        _id: 'li.toTreehouseFromTarzanInvite' + seed,
        _to: treehouse._id,
        type: 'share',
      }, {
        _id: 'li.toJaneFromTarzanInvite' + seed,
        _to: jane._id,
        type: 'share',
      }],
      returnNotifications: true,
    },
  }, 201, function(err, res, body) {
    t.get('/data/links/li.toJaneFromTarzanInvite' + seed,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(jane._id === body.data._owner)
      t.get('/data/links/li.toTreehouseFromTarzanInvite' + seed,
      function(err, res, body) {
        t.assert(body.data)
        t.assert(tarzan._id === body.data._owner)
        test.done()
      })
    })
  })
}

/*
 * This should change to be a check for reading notifications including
 * tarzans invite.
 */
_exports.janeCanReadTarzansInvite = function(test) {
  t.post({
    uri: '/do/getMessages?' + jane.cred,
    body: {
      entityId: jane._id,
      cursor: {
        limit: 50,
        linkTypes: ['share'],
        schemas: ['message'],
        skip: 0,
        sort: { modifiedDate: -1 },
      },
      links: {
        shortcuts: true,
        active: [{
          schema: 'message',
          type: 'share',
          direction: 'in',
        }]
      },
      log: true,
    },
  }, function(err, res, body) {
    t.assert(body.count === 2)

    async.eachSeries(body.data, getMessage, done)

    function getMessage(msg, next) {
      t.get('/do/getEntities?entityIds[0]=' + msg._id + '&' + jane.cred,
      function(err, res, body) {
        if (err) return next(err)
        t.assert(body.count)
        next()
      })
    }

    function done(err) {
      if (err) t.assert(false, err)
      test.done()
    }
  })
}


exports.janeAcceptsTarzanInvite = function(test) {
  t.post({
    uri: '/do/insertLink?' + jane.cred,
    body: {
      toId: treehouse._id,
      fromId: jane._id,
      type: 'watch',
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length == 1)
    // enabled because we recognized outstanding invitation
    t.assert(body.data[0].enabled === true)
    test.done()
  })
}

exports.janeCannotSeeTreehouseMessagesViaFind = function(test) {
  t.get('/find/messages?' + jane.cred,
  function(err, res, body) {
    t.assert(body.count)
    body.data.forEach(function(msg) {
      t.assert(msg._owner === jane._id)
    })
    test.done()
  })
}

exports.janeCanSeeTreehouseMessagesViaFindOne = function(test) {
  t.get('/find/messages/' + 'me.tarzanToTreehouse' + seed + '?' + jane.cred,
  function(err, res, body) {
    t.assert(body.data)
    test.done()
  })
}

exports.janeCanNestAMessageOnTarzansTreehouseMessage = function(test) {
  var janeMessageOnMessage = {
    entity: {
      schema: 'message',
      _id: 'me.janeMessageOnTarzanMsg' + seed,
      description: 'Trust me, you will like bed',
    },
    links: [{
      _to: 'me.tarzanToTreehouse' + seed,
      type: 'content',
    }],
    returnNotifications: true,
  }
  t.post({
    uri: '/do/insertEntity?' + jane.cred,
    body: janeMessageOnMessage,
  }, 201, function(err, res, body) {
    t.assert(body.count)
    t.assert(body.data._acl === 'pa.treehouse' + seed)  // checks setAcl in insertEntity
    test.done()
  })
}

exports.janeCanSendsMessageToTreehouse = function(test) {
  t.post({
    uri: '/do/insertEntity?' + jane.cred,
    body: {
      entity: {
        schema: 'message',
        _id: 'me.janeToTreehouse' + seed,
        description: 'Hmm, maybe hammock is ok afterall...',
      },
      links: [{
        _to: treehouse._id,
        type: 'content',
      }]
    },
  }, 201, function(err, res, body) {
    test.done()
  })
}

exports.janeCanEditHerMessageToTreehouse = function(test) {
  t.post({
    uri: '/data/messages/me.janeToTreehouse' + seed + '?' + jane.cred,
    body: {
      data: {
        description: 'On second thought, hammock sucks',
      },
    },
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.description === 'On second thought, hammock sucks')
    test.done()
  })
}

exports.janeCanDeleteHerMessageToTreehouse = function(test) {
  t.del({
    uri: '/data/messages/me.janeToTreehouse' + seed + '?' + jane.cred,
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.get('/data/links?query[_from]=me.janeToTreehouse' + seed + '&query[_to]=' + treehouse._id + '&' + jane.cred,
    function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}

