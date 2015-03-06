/**
 *  Private patches tests
 */

var async = require('async')
var util = require('proxutils')
var seed = util.seed(6)  // for running tests concurrently
var seed2 = util.seed(6)
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.safeDb   // raw mongodb connection object without mongoSafe wrapper
var admin = {}
var photo = {
  prefix: 'picture.jpg',
  source: 'aircandi.users'
}

// Generate a random location on earth based on seeds 1 and 2
// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var base = Math.pow(10,6) // second param should be the same as the seed precision
var lat = ((Number(seed) % 179) - 89) + (Number(seed2) / base)
var lng = ((Number(seed2) % 359) - 179) + (Number(seed) / base)
var distance = 0.0001 // distance between patches in lat / lng increments, should be 100 meters or so


var _exports = {}  // For commenting out tests

var tarzan = {
  _id: 'us.tarzan' + seed,
  name: 'tarzan' + seed,
  email: 'tarzan' + seed + '@3meters.com',
  password: 'foobar',
  photo: photo,
}

var jane = {
  _id: 'us.jane' + seed,
  name: 'jane' + seed,
  email: 'jane' + seed + '@3meters.com',
  password: 'foobar',
  photo: photo,
}

var mary = {
  _id: 'us.mary' + seed,
  name: 'mary' + seed,
  email: 'mary' + seed + '@3meters.com',
  password: 'foobar',
  photo: photo,
}

var river = {
  _id: 'pa.river' + seed,
  name: 'River' + seed,
  photo: photo,
  location: {
    lat: lat,
    lng: lng,
  },
}

var treehouse = {
  _id: 'pa.treehouse' + seed,
  name: 'Treehouse' + seed,
  visibility: 'private',
  location: {
    lat: lat + distance,
    lng: lng,
  },
}

var janehouse = {
  _id: 'pa.janehouse' + seed,
  name: 'Janehouse' + seed,
  visibility: 'private',
  location: {
    lat: lat + (2 * distance),
    lng: lng,
  },
}

var maryhouse = {
  _id: 'pa.maryhouse' + seed,
  name: 'Maryhouse' + seed,
  visibility: 'private',
  location: {
    lat: lat + (3 * distance),
    lng: lng,
  },
}

var jungle = {
  _id: 'pl.jungle' + seed,
  name: 'Jungle' + seed,
  location: {
    lat: lat,
    lng: lng
  }
}

log('Patch locations', {
  river: river.location,
  treeh: treehouse.location,
  janeh: janehouse.location,
  maryh: maryhouse.location,
})

var beacon1 = {
  bssid: 'Beacon1.' + seed,
  location: {
    lat: lat,
    lng: lng
  }
}

var beacon2 = {
  bssid: 'Beacon2.' + seed,
  location: {
    lat: lat + distance,
    lng: lng
  }
}


exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    admin._id = session._owner
    admin.cred = 'user=' + session._owner +
        '&session=' + session.key + '&install=' + seed
    test.done()
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

exports.adminCreatePlaces = function(test) {

  // Admin creates the Jungle
  t.post({
    uri: '/data/places?' + admin.cred,
    body: {data: jungle},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data._owner === admin._id)
    test.done()
  })
}

exports.createBeacons = function(test) {

  // Tarzan creates beacons
  t.post({
    uri: '/data/beacons?' + tarzan.cred,
    body: {data: beacon1},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data._owner === admin._id)  // Admins own beacons
    t.assert(body.data._creator === tarzan._id)
    beacon1 = body.data
    t.post({
      uri: '/data/beacons?' + jane.cred,
      body: {data: beacon2},
    }, 201, function (err, res, body) {
      beacon2 = body.data
      test.done()
    })
  })
}

exports.createPatches = function(test) {

  // Tarzan creates public river patch
  t.post({
    uri: '/data/patches?' + tarzan.cred,
    body: {data: river},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data.visibility === 'public')  // proves default

    // Tarzan creates private treehouse patch
    t.post({
      uri: '/data/patches?' + tarzan.cred,
      body: {data: treehouse},
    }, 201, function (err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data.visibility === 'private')

      // Jane creates private janehouse patch
      t.post({
        uri: '/data/patches?' + jane.cred,
        body: {data: janehouse},
      }, 201, function (err, res, body) {
        t.assert(body.count === 1)
        t.assert(body.data.visibility === 'private')

        // Tarzan can find and edit the patch he created
        t.get('/data/patches/' + river._id + '?' + tarzan.cred,
        function(err, res, body) {
          t.assert(body.data && body.data._id)
          t.assert(body.count === 1)
          t.assert(body.canEdit === true)

          // Tarzan can find but not edit the patch Jane created
          t.get('/data/patches/' + janehouse._id + '?' + tarzan.cred,
          function(err, res, body) {
            t.assert(body.data && body.data._id)
            t.assert(body.canEdit === false)
            test.done()
          })
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
    uri: '/data/messages?' + tarzan.cred,
    body: {
      data: {
        _id: 'me.tarzanToRiver' + seed,
        description: 'Good water, bad crocs',
        links: [{
          _to: river._id,
          type: 'content',
        }],
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._owner === tarzan._id)
    t.assert(body.data._acl === river._id)      // gets its permissions from river
    t.assert(body.data.links)
    t.assert(body.data.links.length === 1)
    // t.assert(body.data.notifications)
    test.done()
  })
}


exports.janeSendsMessageToPublicRiver = function(test) {
  t.post({
    uri: '/data/messages?' + jane.cred,
    body: {
      data: {
        _id: 'me.janeToRiver' + seed,
        description: 'I love swimming',
        links: [{
          _to: river._id,
          type: 'content',
        }],
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    test.done()
  })
}


exports.messagesToPublicRiverAreVisibleToAnon = function(test) {
  t.post({
    uri: '/find/patches/' + river._id,
    body: {linked: {from: 'messages', type: 'content'}},
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._id)
    t.assert(body.data.linked)
    t.assert(body.data.linked.length === 2)
    t.assert(body.data.linked[0]._owner = jane._id)
    t.assert(body.data.linked[1]._owner = tarzan._id)
    test.done()
  })
}


exports.tarzanSendsMessageToTreehouse = function(test) {
  t.post({
    uri: '/data/messages?' + tarzan.cred,
    body: {
      data: {
        _id: 'me.tarzanToTreehouse' + seed,
        description: 'Check out my hammock',
        links: [{
          _to: treehouse._id,
          type: 'content',
        }],
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._acl === treehouse._id)
    test.done()
  })
}


exports.janeSendsMessageToJanehouse = function(test) {
  t.post({
    // Deprecated:  use /data/messages instead
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


exports.tarzanSendsMessageToJanehouseAndPartiallyFails = function(test) {
  t.post({
    uri: '/data/messages?' + tarzan.cred,
    body: {
      data: {
        _id: 'me.tarzanToJanehouse' + seed,
        description: 'What is bed?',
        links: [{
          _to: janehouse._id,
          type: 'content',
        }],
      },
      test: true,
    },
  }, 202, function(err, res, body) {
    t.assert(body.data)   // the message was created and saved
    t.assert(body.data.links.length === 0)   // but it was not linked to Janehouse
    t.assert(body.errors)
    t.assert(body.errors[0].type === 'insertLink')
    t.assert(body.errors[0].error.code === 401) // bad auth, tarzan is not watching janehouse
    test.done()
  })
}


exports.messagesAreOwnerAccess = function(test) {
  t.get('/find/messages/me.tarzanToRiver' + seed,
  function(err, res, body) {
    t.assert(body.count === 1)  // anon user can see messages to public patch
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
            t.get('/find/messages/me.tarzanToTreehouse',
            function(err, res, body) {
              t.assert(body.count === 0) // anon user cannot see messages to private
              test.done()
            })
          })
        })
      })
    })
  })
}


exports.getEntsForEntsDoesNotExposePrivateFieldsOfWatchers = function(test) {
  t.post({
    // Deprecated: use /find/messages
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

exports.findWithLinkedDoesNotExposePrivateFieldsOfWatches = function(test) {
  t.post({
    uri: '/find/patches/' + river._id,
    body: {
      linked: {
        from: 'users',
        filter: {type: 'watch'},
        linkFields: {},
      }
    },
  }, function(err, res, body) {
    t.assert(body.data)
    var watchLinks = body.data.linked
    t.assert(watchLinks.length)
    watchLinks.forEach(function(user) {
      t.assert(user.name)
      t.assert(!user.email)
      t.assert(user.link)
      t.assert(user.link.type === 'watch')
    })
    test.done()
  })
}

exports.getEntitiesForEntsReadsMessagesToPublicPatches = function(test) {
  t.post({
    // Deprecated, use find/patches
    uri: '/do/getEntitiesForEntity',
    body: {
      entityId: 'pa.river' + seed,
      cursor: {
        linkTypes: ['content'],
        direction: 'in',
      },
    },
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.data[0].description === 'I love swimming')
    t.assert(body.data[1].description === 'Good water, bad crocs')
    test.done()
  })
}


exports.findLinkedReadsMessagesToPublicPatches = function(test) {
  t.post({
    // Supported
    uri: '/find/patches/' + river._id,
    body: {
      linked: [{from: 'messages', type: 'content'}]
    },
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data._id === river._id)
    t.assert(body.data.linked)
    t.assert(body.data.linked.length === 2)
    t.assert(body.data.linked[0].description === 'I love swimming')
    t.assert(body.data.linked[1].description === 'Good water, bad crocs')
    test.done()
  })
}


exports.tarzanCannotInviteHimselfToJanehouse = function(test) {
  t.post({
    uri: '/data/links?' + tarzan.cred,
    body: {
      data: {
        _id: 'li.tarzanInvitesHimselfOver' + seed,
        _from: janehouse._id,
        _to: tarzan._id,
        type: 'share',
      }
    },
  }, 401, function(err, res, body) {
    test.done()
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
    // Deprecated, use /find/patches
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
      linked: {
        from: 'messages',
        filter: {type: 'messages'},
      }
    },
  }, function(err, res, body) {
    t.assert(body.data.linked.length === 0)
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
    uri: '/find/patches/' + janehouse._id + '?' + tarzan.cred,
    body: {
      linked: {from: 'messages', type: 'content'}
    },
  }, function(err, res, body) {
    t.assert(body.data.linked.length === 1)
    t.assert(body.data.linked[0].description)
    t.assert(body.data.linked[0].collection === 'messages')
    t.assert(!body.data.linked[0].link)  // because no linkFields param
    test.done()
  })
}

exports.tarzanInvitesJaneToTreehouse = function(test) {
  t.post({
    uri: '/data/messages?' + tarzan.cred,
    body: {
      data: {
        _id: 'me.tarzanInvite' + seed,
        type: 'root',
        description: 'Check out my treehouse',
        links: [{
          _id: 'li.toTreehouseFromTarzanInvite' + seed,
          _to: treehouse._id,
          type: 'share',
        }, {
          _id: 'li.toJaneFromTarzanInvite' + seed,
          _to: jane._id,
          type: 'share',
        }],
      },
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

exports.janeAcceptsTarzanInviteByCreatingAWatchLink = function(test) {
  t.post({
    uri: '/data/links?' + jane.cred,
    body: {
      data: {
        _to: treehouse._id,
        _from: jane._id,
        type: 'watch',
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    // enabled because we recognized the existing share link, meaning an invitation
    t.assert(body.data.enabled === true)
    test.done()
  })
}

exports.janeCannotSeeTreehouseMessagesWithFind = function(test) {
  t.get('/find/messages?' + jane.cred,
  function(err, res, body) {
    t.assert(body.count)
    body.data.forEach(function(msg) {
      t.assert(msg._owner === jane._id)
      t.assert(msg._id !== 'me.tarzanToTreehouse' + seed)  // only findOne checks parent permissions
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

// We don't nest messages in the current client ui, but this tests proves
// that the security model still works if we ever decide to
exports.janeCanNestAMessageOnTarzansTreehouseMessage = function(test) {
  var janeMessageOnMessage = {
    data: {
      _id: 'me.janeMessageOnTarzanMsg' + seed,
      description: 'Trust me, you will like bed',
      links: [{
        _to: 'me.tarzanToTreehouse' + seed,
        type: 'content',
      }],
    },
  }
  t.post({
    uri: '/data/messages?' + jane.cred,
    body: janeMessageOnMessage,
  }, 201, function(err, res, body) {
    t.assert(body.count)
    t.assert(body.data._acl === 'pa.treehouse' + seed)  // the message's grandparent, not parent
    test.done()
  })
}

exports.janeCanSendsMessageToTreehouse = function(test) {
  t.post({
    uri: '/data/messages?' + jane.cred,
    body: {
      data: {
        _id: 'me.janeToTreehouse' + seed,
        description: 'Hmm, maybe hammock is ok afterall...',
        links: [{_to: treehouse._id, type: 'content'}]
      },
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

exports.maryCanCreatePatchAndLinksToAndFromItInOneRestCall = function(test) {

  var patch = util.clone(maryhouse)
  patch.links = [
    {_from: mary._id, type: 'create'},
    {_from: mary._id, type: 'watch'},
    {_to: jungle._id, type: 'proximity'},
    {_to: beacon1._id, type: 'proximity'},
    {_to: beacon1._id, type: 'bogus'},      // Will fail
  ]

  t.post({
    uri: '/data/patches?' + mary.cred,
    body: {data: patch},
  }, 202, function(err, res, body) {  // 202 means partial success, look at errors
    t.assert(body.data)
    t.assert(body.data.links)
    t.assert(body.data.links.length === 4)
    body.data.links.forEach(function(link) {
      t.assert(link._to)
      t.assert(link._from)
      t.assert(link.type)
      t.assert(link._id)
      t.assert(link._id.indexOf('li.' === 0))
    })
    t.assert(body.errors)
    t.assert(body.errors.length === 1)
    test.done()
  })
}


exports.findWithNestedLinks = function(test) {
  t.post({
    uri: '/find/users/' + tarzan._id + ',' + jane._id + ',' + mary._id + '?' + tarzan.cred,
    body: {refs: 'name,photo',
      linked: [
        {to: 'patches', type: 'watch', fields: 'name,visibility,photo', linkFields: 'enabled', linked: [
          {from: 'messages', type: 'content', fields: 'description,photo', linkFields: false},
          {from: 'users', type: 'watch', count: true},
          {from: 'users', type: 'like', count: true},
        ]}
      ]
    },
  }, function(err, res, body) {
    var cMessages = 0
    t.assert(body.data.length === 3)
    body.data.forEach(function(user) {
      t.assert(user.collection === 'users')
      t.assert(user.name)
      t.assert(!user.email)
      t.assert(user.linked)
      user.linked.forEach(function(patch) {
        t.assert(patch._id)
        t.assert(patch.collection === 'patches')
        t.assert(patch._owner)
        t.assert(patch.owner)  // ref
        t.assert(patch.owner.name)
        t.assert(patch.owner.photo)
        t.assert(patch.linked)
        t.assert(patch.linkedCount)
        patch.linked.forEach(function(message) {
          t.assert(message.collection === 'messages')
          t.assert(!message.link)  // excluded
          cMessages++
        })
        t.assert(tipe.isDefined(patch.linkedCount.from.users.watch))
        t.assert(tipe.isDefined(patch.linkedCount.from.users.like))
      })
    })
    test.done()
  })
}


// Find messages for patches with new find syntax vs deprecated
// getEnitiesForEntity syntax
exports.FindPatchMessagesCompareGetEntities = function(test) {

  // Recommended syntax
  t.post({
    uri: '/find/patches/' + river._id + '?' + tarzan.cred,
    body: {
      refs: '_id,name,photo,schema',
      linked: [{from: 'messages', type: 'content', linkFields: '_id'}]
    }
  }, function(err, res, body) {
    var rfind = body.data

    // Deprecated syntax sent by the android client version 1.5x and earlier
    t.post({
      uri: '/do/getEntitiesForEntity?' + tarzan.cred,
      body: {
        entityId: river._id,
        cursor:
         { where: { enabled: true },
           skip: 0,
           sort: { modifiedDate: -1 },
           schemas: [ 'message' ],
           limit: 50,
           linkTypes: [ 'content' ],
           direction: 'in' },
        links: {
          shortcuts: true,
          active: [
            { links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'both' },
            { links: true, count: true, schema: 'patch', type: 'content', limit: 1, direction: 'out' },
            { links: true, count: true, schema: 'patch', type: 'share', limit: 1, direction: 'out' },
            { links: true, count: true, schema: 'message', type: 'share', limit: 1, direction: 'out' },
            { links: true, count: true, schema: 'user', type: 'share', limit: 5, direction: 'out' },
            { where: { _from: tarzan._id }, links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in' }
          ]
        }
      }
    }, function(err, res, body) {
      var rge = body.data

      // find returns the river patch on top and includes messages in an array named 'linked'
      t.assert(rfind.linked.length === rge.length)
      t.assert(rfind._id === river._id)
      rfind.linked.forEach(function(message) {
        t.assert(message.schema === 'message')
        t.assert(message.description)
        t.assert(message.description.length)
        t.assert(message.link._id)
      })

      // get entities returns an array of messages, each with a copy of the river
      // patch included as a shortcut under the content link
      rge.forEach(function(message) {
        t.assert(message.schema === 'message')
        t.assert(message.description)
        t.assert(message.description.length)
        t.assert(message.linksOut.length === 1)
        t.assert(message.linksOut[0]._to === river._id)
        t.assert(message.linksOut[0].shortcut.name === river.name)
        t.assert(message._link)
      })

      test.done()
    })
  })
}


exports.findMyPatchesCompareGetEntities = function(test) {
  t.post({
    // Supported syntax
    uri: '/find/users/' + tarzan._id + '?' + tarzan.cred,
    body: {
      refs: true,
      linked: [
        {to: 'patches', type: 'watch', limit: 30, fields: 'name,schema,visibility', linked: [
          {to: 'beacons', type: 'proximity', limit: 10},
          {to: 'places', type: 'proximity', fields: 'name,schema,category,photo', limit: 1},
          {from: 'messages', type: 'content', fields: 'schema,description', limit: 2},
          {from: 'messages', type: 'content', count: true},
          {from: 'users', type: 'like', count: true},
          {from: 'users', type: 'watch', filter: {enabled: true}, count: true},
        ]}
      ]
    }
  }, function(err, res, body) {
    var rfind = body.data
    t.assert(rfind._id === tarzan._id)
    t.post({
      // Deprecated syntax sent by Android client 1.5* and earlier
      uri: '/do/getEntitiesForEntity?' + tarzan.cred,
      body: {
        entityId: tarzan._id,
        cursor:
         { where: { enabled: true },
           skip: 0,
           sort: { modifiedDate: -1 },
           schemas: [ 'patch' ],
           limit: 30,
           linkTypes: [ 'watch' ],
           direction: 'out' },
        links: {
        shortcuts: true,
          active: [
            {links: true, count: true, schema: 'beacon', type: 'proximity', limit: 10, direction: 'out'},
            {links: true, count: true, schema: 'place', type: 'proximity', limit: 1, direction: 'out'},
            {links: true, count: true, schema: 'message', type: 'content', limit: 2, direction: 'both'},
            {where: {_from: tarzan._id}, links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in'},
            {where: {_from: tarzan._id}, links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in'},
            {where: {_creator: tarzan._id}, links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in'}
          ]
        }
      }
    }, function(err, res, body) {
      var rge = body.data
      // log('find', rfind)
      // log('getEnts', rge)

      // find returns tarzan on top with an array of linked patches.
      // Under each patch is an array of linked entities, of type beacon, place, or message,
      // and a linkedCount object that counts messages, watches, and likes to the patch
      t.assert(rfind.linked.length === rge.length)
      var cMessagesTot = 0
      rfind.linked.forEach(function(patch) {
        var cMessagesPerPatch = 0
        t.assert(patch.schema === 'patch')
        t.assert(patch.collection === 'patches')
        t.assert(patch.linkedCount)
        t.assert(tipe.isNumber(patch.linkedCount.from.messages.content))
        t.assert(tipe.isNumber(patch.linkedCount.from.users.watch))
        t.assert(tipe.isNumber(patch.linkedCount.from.users.like))
        t.assert(patch.linked)
        patch.linked.forEach(function(ent) {
          t.assert(ent.schema)
          t.assert(ent.schema.match(/message|place|beacon/))
          if (ent.schema === 'message') {
            cMessagesPerPatch++
            cMessagesTot++
          }
        })
        t.assert(cMessagesPerPatch <= 2)  // proves link limit works
      })
      t.assert(cMessagesTot > 2)

      // getEntities returns an array of patches, each with two nested arrays,
      // linksIn and linksInCounts.  The linksIn array contains an array of links
      // with the linkedDocument include as a property called shortcut
      rge.forEach(function(patch) {
        t.assert(patch.schema === 'patch')
        t.assert(patch.collection === 'patches')
        t.assert(patch.linksInCounts)
        t.assert(patch.linksInCounts[0].type === 'content')
        t.assert(patch.linksInCounts[1].type === 'watch')
        t.assert(patch.linksIn)
        patch.linksIn.forEach(function(link) {
          t.assert(link._id.match(/^li\./))
          t.assert(link.shortcut)
          t.assert(link.shortcut.schema.match(/message|place|beacon|user/))
        })
      })
      test.done()
    })
  })
}


// Patches near with new and old apis
exports.patchesNear = function(test) {

  var location = {
      lat: lat,
      lng: lng,
      accuracy: 1000,
      provider: 'fused',
  }

  t.post({
    // Supported syntax
    uri: '/patches/near',
    body: {
      location: location,
      radius: 10000,
      installId: 'todo',
      limit: 50,
      rest: true,   // set to use supported rest Api rather than deprecated getEntities
      linked: [
        {to: 'beacons', type: 'proximity', limit: 10},
        {to: 'places', type: 'proxmity', limit: 10},
        {from: 'messages', type: 'content', limit: 2},
        {from: 'messages', type: 'content', count: true},
        {from: 'users', type: 'like', count: true},
        {from: 'users', type: 'watch', count: true},
      ]
    }
  }, function(err, res, body) {
    var patchesFind = body.data
    t.assert(patchesFind.length === 4)
    t.assert(patchesFind[0]._id = river._id)      // sorted by distance from query location
    t.assert(patchesFind[1]._id = treehouse._id)
    t.assert(patchesFind[2]._id = janehouse._id)
    t.assert(patchesFind[3]._id = maryhouse._id)
    patchesFind.forEach(function(patch) {
      t.assert(patch.linked)
      t.assert(patch.linkedCount.from)
      t.assert(patch.linkedCount.from.messages)
      t.assert(patch.linkedCount.from.users)
    })
    t.post({
      // Deprecated syntax
      uri: '/patches/near',
      body: {
        location: location,
        radius: 10000,
        installId: 'todo',
        limit: 50,
        links: {shortcuts: true, active: [
          {links: true, count: true, schema: 'beacon', type: 'proximity', limit: 10, direction: 'out' },
          {links: true, count: true, schema: 'place', type: 'proximity', limit: 1, direction: 'out' },
          {links: true, count: true, schema: 'message', type: 'content', limit: 2, direction: 'both' },
          {where: { _from: 'us.130820.80231.131.599884' },
            links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in' },
          {where: { _from: 'us.130820.80231.131.599884' },
            links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in' },
          {where: { _creator: 'us.130820.80231.131.599884' },
            links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in' }
        ]},
      },
    }, function(err, res, body) {
      var patchesGe = body.data
      t.assert(patchesGe.length === 4)
      test.done()
    })
  })
}
