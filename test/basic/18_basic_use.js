/**
 *  Patchr basic use test
 *
 *  If this test passes the clients should work reasonably well in
 *  our main cases.
 *
 *  To run stand-alone:
 *
 *     cd $SRC/test
 *     node test -t /basic/18*
 *
 *  Safe to run concurrently simulating real use
 *
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
var _exports = {}  // For commenting out tests


// Generate a random location on earth based on seeds 1 and 2
// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var base = Math.pow(10,6) // second param should be the same as the seed precision
var lat = ((Number(seed) % 179) - 89) + (Number(seed2) / base)
var lng = ((Number(seed2) % 359) - 179) + (Number(seed) / base)
var distance = 0.0001 // distance between patches in lat / lng increments, should be 100 meters or so


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

// Jungle is a place, not a patch
var jungle = {
  _id: 'pl.jungle' + seed,
  name: 'Jungle' + seed,
  location: {
    lat: lat,
    lng: lng,
  }
}

// Set by tests
var linkTarzanWatchesRiver = {}
var linkTarzanWatchesTreehouse = {}
var linkJaneWatchesRiver = {}


var beacons = [
  {
    bssid: 'Beacon1.' + seed,
    location: {
      lat: lat,
      lng: lng,
    }
  }, {
    bssid: 'Beacon2.' + seed,
    location: {
      lat: lat + distance,
      lng: lng,
    }
  }, {
    bssid: 'Beacon3.' + seed,
    location: {
      lat: lat + (2 * distance),
      lng: lng,
    }
  }, {
    bssid: 'Beacon4.' + seed,
    location: {
      lat: lat + (3 * distance),
      lng: lng,
    }
  },
]


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
      installId: 'in.' + tarzan._id,
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
        installId: 'in.' + jane._id,
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
          installId: 'in.' + mary._id,
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


var _install = {
  clientVersionCode: 80,
  clientVersionName: '1.0.0',
  deviceType: 'ios',
  deviceVersionName: '8.0.0',
  locationDate: util.now(),
}

exports.registerInstalls = function(test) {
  var install = _.extend({
    _user: tarzan._id,
    parseInstallId: 'tarzanParseId',
    installId: 'in.' + tarzan._id,
    location: treehouse.location,
  }, _install)
  t.post({
    uri: '/do/registerInstall?' + tarzan.cred,
    body: {install: install},
  }, function(err, res, body) {
    install = _.extend({
      _user: jane._id,
      parseInstallId: 'janeParseId',
      installId: 'in.' + jane._id,
      location: janehouse.location,
    }, _install)
    t.post({
      uri: '/do/registerInstall?' + jane.cred,
      body: {install: install},
    }, function(err, res, body) {
      install = _.extend({
        _user: jane._id,
        parseInstallId: 'maryParseId',
        installId: 'in.' + mary._id,
        location: maryhouse.location,
      }, _install)
      t.post({
        uri: '/do/registerInstall?' + mary.cred,
        body: {install: install},
      }, function(err, res, body) {
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
    t.assert(!body.notifications)  // because jungle is a place, not a patch
    test.done()
  })
}


exports.createManyBeaconsInOnePost = function(test) {
  // Tarzan creates beacons
  t.post({
    uri: '/data/beacons?' + tarzan.cred,
    body: {data: beacons},
  }, 201, function (err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === beacons.length)
    body.data.forEach(function(beacon) {
      t.assert(beacon._id === 'be.' + beacon.bssid)
      t.assert(beacon._owner === admin._id)  // Admins own beacons
      t.assert(beacon._creator === tarzan._id)
    })
    // Set the module global beacons array to the fully
    // fleshed-out versions saved on the server
    beacons = body.data
    test.done()
  })
}


exports.idempotentUpsertManyBeaconsInOnePut = function(test) {
  // This is exprimental and may change
  t.put({
    uri: '/data/beacons?' + tarzan.cred,
    body: {data: beacons},
  }, 200, function (err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === beacons.length)
    body.data.forEach(function(putBeacon, i) {
      t.assert(putBeacon._id === beacons[i]._id)
      t.assert(putBeacon.modifiedDate > beacons[i].modifiedDate)
      t.assert(putBeacon.activityDate === beacons[i].activityDate)
      beacons[i].modifiedDate = putBeacon.modifiedDate   // this should be the only property that has changed
    })
    t.assert(_.isEqual(body.data, beacons))
    test.done()
  })
}


exports.createPatches = function(test) {

  // Tarzan creates public river patch
  t.post({
    uri: '/data/patches?' + tarzan.cred,
    body: {data: river, test: true},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data.visibility === 'public')  // proves default

    // Check nearby notifcations for patch creation
    t.assert(body.notifications && body.notifications.length === 1)
    var parseInstallIds = body.notifications[0].parseInstallIds
    t.assert(parseInstallIds)
    t.assert(parseInstallIds.indexOf('janeParseId') >= 0)
    t.assert(parseInstallIds.indexOf('maryParseId') >= 0)
    t.assert(parseInstallIds.indexOf('tarzanParseId') < 0)  // Tarzan created, don't notifiy

    // Confirm that the watch link was created automatically
    t.assert(body.data.links)
    t.assert(body.data.links.length === 1)
    // Module global
    linkTarzanWatchesRiver = body.data.links[0]
    t.assert(linkTarzanWatchesRiver.type === 'watch')
    t.assert(linkTarzanWatchesRiver.enabled === true)

    // Tarzan creates private treehouse patch
    t.post({
      uri: '/data/patches?' + tarzan.cred,
      body: {data: treehouse, test: true},
    }, 201, function (err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data.visibility === 'private')
      t.assert(body.data.links && body.data.links.length === 1)
      // Module global
      linkTarzanWatchesTreehouse = body.data.links[0]

      // Jane creates private janehouse patch
      t.post({
        uri: '/data/patches?' + jane.cred,
        body: {data: janehouse, test: true},
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


// When a user creates a patch we create a watch link for her.
// This is returned in the insert call in a links array.  We
// also create a create link for all entities, patches and messages,
// but those are not returned in the response since they are just
// extra bits that are of no use to the client.  This test confirms
// that both links were created.
exports.tarzanAutoWatchedAndAutoCreatedRiver = function(test) {
  t.post({
    uri: '/find/links?' + tarzan.cred,
    body: {query: {
      _to: river._id,
      _from: tarzan._id,
    }},
  }, 200, function(err, res, body) {
    t.assert(body.data.length === 2)
    t.assert(body.data[0].type === 'create')
    t.assert(body.data[1].type === 'watch')
    t.assert(body.data[1].enabled === true)
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
      },
      links: [{_to: river._id, type: 'content'}],
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._owner === tarzan._id)
    t.assert(body.data._acl === river._id)      // gets its permissions from river
    t.assert(body.data.links)
    t.assert(body.data.links.length === 1)
    t.assert(body.data.links[0].type === 'content')
    t.assert(body.notifications.length === 0)   // Tarzan is the only watcher
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
      },
      links: [{_to: river._id, type: 'content'}],
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.notifications)
    t.assert(body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds)
    t.assert(body.notifications[0].parseInstallIds.indexOf('tarzanParseId') >= 0)
    test.done()
  })
}


exports.messagesToPublicRiverAreVisibleToAnonUser = function(test) {
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
      },
      links: [{ _to: treehouse._id, type: 'content'}],
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._acl === treehouse._id)
    t.assert(body.notifications && body.notifications.length === 0)
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
      links: [{_to: janehouse._id, type: 'content'}],
      test: true,
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
      },
      links: [{_to: janehouse._id, type: 'content'}],
      test: true,
    },
  }, 202, function(err, res, body) {
    t.assert(body.data && body.data._id)          // the message was created and saved
    t.assert(body.data.links.length === 0)        // but it was not linked to Janehouse
    t.assert(body.errors)
    t.assert(body.errors[0].type === 'insertLink')
    t.assert(body.errors[0].error.code === 401)   // bad auth, tarzan is not watching janehouse
    t.assert(!body.notifications)                 // because the link itself was never created
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
      t.assert(!user.email)   // private field
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
      test: true,
    },
  }, function(err, res, body) {
    t.assert(body.count === 2)
    t.assert(body.data[0].description === 'I love swimming')
    t.assert(body.data[1].description === 'Good water, bad crocs')
    test.done()
  })
}


exports.findLinkedReadsMessagesToPublicPatches = function(test) {
  // Supported rest find with a post
  t.post({
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


var linkTarzanWatchesJanehouse = {
  _id: 'li.tarzanWatchesJaneHouse' + seed,
  _from: tarzan._id,
  _to: janehouse._id,
  type: 'watch',
}

exports.tarzanRequestsToWatchJanehouse = function(test) {
  t.get('/find/users/' + jane._id + '?' + tarzan._id,
  function (err, res, body) {
    var recentJane = body.data
    t.assert(recentJane)
    t.assert(recentJane.notifiedDate)  // This should be advanced when Jane is notified
    t.post({
      uri: '/data/links?' + tarzan.cred,
      body: {
        data: linkTarzanWatchesJanehouse,
        test: true
      },
    }, 201, function(err, res, body) {
      t.assert(body.data)
      linkTarzanWatchesJanehouse = body.data
      t.assert(jane._id === linkTarzanWatchesJanehouse._owner)
      t.assert(linkTarzanWatchesJanehouse.enabled === false)  // Because Janehouse is private
      t.assert(body.notifications)
      t.assert(body.notifications.length === 1)
      t.assert(body.notifications[0].parseInstallIds[0].indexOf('jane' >= 0))

      // Test that Jane's notifiedDate was updated.  We can use this to
      // prevent shelling her with too many notifications at a time
      t.get('/find/users/' + jane._id + '?' + tarzan._id,
      function (err, res, body) {
        var nowJane = body.data
        t.assert(nowJane)
        t.assert(nowJane.notifiedDate > recentJane.notifiedDate)  // Proves we know we notified Jane
        t.assert(nowJane.notifiedDate > nowJane.activityDate)
        t.assert(nowJane.notifiedDate > nowJane.modifiedDate)
        test.done()
      })
    })
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
    uri: '/data/links/' + linkTarzanWatchesJanehouse._id + '?' + tarzan.cred,
    body: {data: {enabled: true}, test: true},
  }, 403, function(err, res, body) {
    test.done()
  })
}


exports.janeCanCountWatchRequests = function(test) {
  t.post({
    uri: '/find/patches/' + janehouse._id + '?' + jane.cred,
    body: {
      linkCount: [
        {from: 'users', type: 'like'},
        {from: 'users', type: 'watch', enabled: true},
      ],
    }
  }, function(err, res, body) {
    t.assert(body && body.data && !body.data.length)
    var patch = body.data
    t.assert(patch._id === janehouse._id)
    t.assert(patch.linkCount.from.users.like === 0)
    t.assert(patch.linkCount.from.users.watch.enabled === 1)
    t.assert(patch.linkCount.from.users.watch.disabled === 1)
    test.done()
  })
}


exports.janeAcceptsTarzansRequest = function(test) {
  t.post({
    uri: '/data/links/' + linkTarzanWatchesJanehouse._id + '?' + jane.cred,
    body: {data: {enabled: true}, test: true},
  }, function(err, res, body) {
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds.indexOf('tarzanParseId') >= 0)
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
      },
      links: [
        {_id: 'li.toTreehouseFromTarzanInvite' + seed, _to: treehouse._id, type: 'share'},
        {_id: 'li.toJaneFromTarzanInvite' + seed, _to: jane._id, type: 'share', }
      ],
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0] === 'janeParseId')
    t.get('/data/links/li.toJaneFromTarzanInvite' + seed,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(jane._id === body.data._owner)   // the owner of the to entity owns the link,
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
      },
      test: true,
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    // Even though treehouse is private this link is created with enabled set to true
    // Because we recognized the existing share link, meaning she had a pending invitation
    t.assert(body.data.enabled === true)
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')
    test.done()
  })
}


exports.janeCannotSeeTreehouseMessagesFromOthersUsingFind = function(test) {
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
  t.get('/find/messages/me.tarzanToTreehouse' + seed + '?' + jane.cred,
  function(err, res, body) {
    t.assert(body.data && body.data._id)
    t.assert(body.count === 1)
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
    },
    links: [{_to: 'me.tarzanToTreehouse' + seed, type: 'content'}],
    test: true,
  }
  t.post({
    uri: '/data/messages?' + jane.cred,
    body: janeMessageOnMessage,
  }, 201, function(err, res, body) {
    t.assert(body.count)
    t.assert(body.data._acl === 'pa.treehouse' + seed)  // The message's grandparent, not parent
    t.assert(!body.notifications)                       // We currently do not notifiy for nested content
    test.done()
  })
}


exports.janeCanSendMessageToTreehouse = function(test) {
  t.post({
    uri: '/data/messages?' + jane.cred,
    body: {
      data: {
        _id: 'me.janeToTreehouse' + seed,
        description: 'Hmm, maybe hammock is ok afterall...',
      },
      links: [{_to: treehouse._id, type: 'content'}],
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')
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
      test: true,
    },
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.description === 'On second thought, hammock sucks')
    t.assert(!body.notificaions)    // no alert on content updates
    test.done()
  })
}


exports.janeCanDeleteHerMessageToTreehouse = function(test) {
  t.del({
    uri: '/data/messages/me.janeToTreehouse' + seed + '?' + jane.cred,
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.get('/data/links?query[_from]=me.janeToTreehouse' + seed + '&query[_to]=' +
        treehouse._id + '&q[test]=1&' + jane.cred,
    function(err, res, body) {
      t.assert(body.count === 0)
      t.assert(!body.notifications)  // No alerts on link delete
      test.done()
    })
  })
}


exports.maryCanCreatePatchAndLinksToAndFromItInOneRestCall = function(test) {

  var patch = util.clone(maryhouse)
  var links = [
    {_from: mary._id, type: 'like'},
    {_to: jungle._id, type: 'proximity'},  // Jungle is a place, not a patch
    {_to: 'be.' + beacons[2].bssid, type: 'proximity'},
    {_to: 'be.' + beacons[0].bssid, type: 'bogus'},      // Will fail
  ]

  t.post({
    uri: '/data/patches?' + mary.cred,
    body: {data: patch, links: links, test: true},
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
    t.assert(body.errors.length === 1)  // The link with the bogus type failed
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds)
    t.assert(body.notifications[0].parseInstallIds.length === 2)       // To tazan and jane
    t.assert(body.notifications[0].notification.trigger === 'nearby')  // New patche created nearby
    test.done()
  })
}


exports.maryCanSendMessageToPublicPatch = function(test) {
  t.post({
    uri: '/data/messages?' + mary.cred,
    body: {
      data: {
        description: 'Hi Tarzan, can I come swimming too?',
        links: [{
          _to: river._id,
          type: 'content'
        }],
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data.links && body.data.links.length)
    t.assert(body.data.links[0]._from === body.data._id)
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0].indexOf('tarzan') >= 0)
    test.done()
  })
}


exports.getTarzanNotifications = function (test) {
  t.get('/user/getNotifications?limit=20&' + tarzan.cred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 5)
    test.done()
  })
}


exports.getTarzanNotificationsPaging = function (test) {
  t.get('/user/getNotifications?limit=2&more=true&' + tarzan.cred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 2)
    t.assert(body.more)
    test.done()
  })
}


exports.janeWatchesPublicPatchRiver = function(test) {
  t.post({
    uri: '/data/links/?' + jane.cred,
    body: {
      data: {
        _to: river._id,
        _from: jane._id,
        type: 'watch',
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data.enabled === true)   // becuase river is public
    linkJaneWatchesRiver = body.data                    // module global
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')  // Tarzan is watching his own patch river
    test.done()
  })
}


exports.marySlipsUp = function(test) {
  t.post({
    uri: '/data/messages?' + mary.cred,
    body: {
      data: {
        description: 'Wow Tarzan, nice loin-cloth',
        links: [{
          _to: river._id,
          type: 'content'
        }],
      },
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data && body.data.links && body.data.links.length)
    t.assert(body.data.links[0]._from === body.data._id)
    t.assert(body.notifications && body.notifications.length === 1)
    var note = body.notifications[0]
    t.assert(note.parseInstallIds.indexOf('janeParseId') >= 0)  // Busted!
    t.assert(note.parseInstallIds.indexOf('tarzanParseId') >= 0)
    t.assert(note.notification)
    t.assert(note.notification.alert)
    t.assert(note.notification.sound)
    t.assert(note.notification.priority === 1)
    test.done()
  })
}


exports.tarzanMutesHisRiverPatch = function(test) {
  t.post({
    uri: '/data/links/' + linkTarzanWatchesRiver._id + '?' + tarzan.cred,
    body: {data: {mute: true}, test: true},
  }, function(err, res, body) {
    t.assert(body.data && body.data.mute)
    test.done()
  })
}


exports.maryWatchesTarzansMutedPublicRiver = function(test) {
  t.post({
    uri: '/data/links/?' + mary.cred,
    body: {data: {_to: river._id, _from: mary._id, type: 'watch'}, test: true},
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.notifications.length === 1)  // Tarzan has muted his public patch river
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')
    t.assert(body.notifications[0].notification.priority === 2)  // Tarzan receives muted notification
    t.del({uri: '/data/links/' + body.data._id + '?' + mary.cred},
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}


exports.maryLikesTarzansMutedPublicRiver = function(test) {
  t.post({
    uri: '/data/links/?' + mary.cred,
    body: {data: {_to: river._id, _from: mary._id, type: 'like'}, test: true},
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.notifications.length === 1)  // Tarzan has muted his public patch river
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')
    t.assert(body.notifications[0].notification.priority === 2)  // Tarzan receives muted notification
    t.del({uri: '/data/links/' + body.data._id + '?' + mary.cred},
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}


// Jane's watch link to river is owned by tarzan, but she can still mute it
exports.janeMutesTarzansRiver = function(test) {
  t.post({
    uri: '/data/links/' + linkJaneWatchesRiver._id + '?' + jane.cred,
    body: {data: {mute: true}, test: true},
  }, function(err, res, body) {
    t.assert(body.data && body.data.mute)
    test.done()
  })
}


exports.marySendsMessageToMutedRiver = function(test) {
  t.post({
    uri: '/data/messages?' + mary.cred,
    body: {
      data: {
        description: 'Sorry Jane!',
        links: [{
          _to: river._id,
          type: 'content',
        }]},
      test: true,
    },
  }, 201, function(err, res, body) {
    t.assert(body.data)
    maryMessage = body.data
    t.assert(body.notifications && body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds.length === 2)  // Tarzan and Jane
    var notification = body.notifications[0].notification
    t.assert(notification)
    t.assert(notification.priority === 2)         // muted
    t.assert(notification["sound-x"])             // Muted alert for ios see
    t.assert(notification["alert-x"])             // https://github.com/3meters/proxibase/issues/347
    t.assert(!notification.alert)
    t.assert(!notification.sound)

    // Now Jane likes mary's message
    t.post({
      uri: '/data/links?' + jane.cred,
      body: {data: {_to: maryMessage._id, _from: jane._id, type: 'like'}, test: true},
    }, 201, function(err, res, body) {
      t.assert(body.data)
      t.assert(body.notifications.length === 1)
      t.assert(body.notifications[0].parseInstallIds[0] === 'maryParseId')
      t.assert(body.notifications[0].notification.priority === 2)
      test.done()
    })
  })
}


exports.janeUnmutesRiver = function(test) {
  t.post({
    uri: '/data/links/' + linkJaneWatchesRiver._id + '?' + jane.cred,
    body: {data: {mute: false}, test: true},
  }, function(err, res, body) {
    t.assert(body.data && body.data.mute === false)
    test.done()
  })
}


exports.likingAPrivatePatchNotifiesPatchOwner = function(test) {
  t.post({
    uri: '/data/links?' + jane.cred,
    body: {data: {_to: treehouse._id, _from: jane._id, type: 'like'}, test: true}
  }, 201, function(err, res, body) {
    var likeLink = body.data
    t.assert(likeLink)
    t.assert(body.notifications.length === 1)
    t.assert(body.notifications[0].parseInstallIds[0] === 'tarzanParseId')
    t.assert(body.notifications[0].notification.priority === 2)     // likes are always pri 2
    t.del({uri: '/data/links/' + likeLink._id + '?' + jane.cred},   // unlike
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}


exports.tarzanUnwatchesTreehouse = function(test) {
  t.del({uri: '/data/links/' + linkTarzanWatchesTreehouse._id + '?' + tarzan.cred},
  function(err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}


exports.likingAnUnWatchedPatchDoesNotNotifyPatchOwner = function(test) {
  t.post({
    uri: '/data/links?' + jane.cred,
    body: {data: {_to: treehouse._id, _from: jane._id, type: 'like'}, test: true}
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.notifications.length === 0)  // No notifications: tarzan has unwatched treehouse
    t.del({uri: '/data/links/' + body.data._id + '?' + jane.cred}, // cleanup
    function(err, res, body) {
      t.assert(body.count === 1)
      test.done()
    })
  })
}



exports.findWithNestedLinks = function(test) {
  t.post({
    // uri: '/find/users/' + tarzan._id + ',' + jane._id + ',' + mary._id + '?' + tarzan.cred,
    uri: '/find/users/' + jane._id + '?' + tarzan.cred,
    body: {refs: 'name,schema,photo',
      linked: {to: 'patches', type: 'watch', fields: 'name,visibility,photo,schema', linkFields: 'enabled',
        linked: {from: 'messages', refs: 'name', type: 'content', fields: 'description,photo,schema', linkFields: false},
        linkCount: [
          {from: 'users', type: 'watch'},
          {from: 'users', type: 'like'},
        ],
      }
    },
  }, function(err, res, body) {
    var cMessages = 0
    t.assert(body.data)
    var user = body.data
    t.assert(user.schema === 'user')
    t.assert(user.name)
    t.assert(!user.email)
    t.assert(user.linked)
    t.assert(user.owner.name)
    user.linked.forEach(function(patch) {
      t.assert(patch._id)
      t.assert(patch.schema === 'patch')
      t.assert(patch._owner)
      t.assert(!patch.owner)  // refs do not cascade
      t.assert(patch.linked)
      patch.linked.forEach(function(message) {
        t.assert(message.schema === 'message')
        t.assert(message.owner)  // refs can be speced at any level
        t.assert(!message.owner.name)
        t.assert(!message.link)  // excluded
        cMessages++
      })
      t.assert(patch.linkCount)
      t.assert(tipe.isDefined(patch.linkCount.from.users.watch))
      t.assert(tipe.isDefined(patch.linkCount.from.users.like))
    })
    t.assert(cMessages)
    test.done()
  })
}


exports.findWithNestedLinksPromoteLinked = function(test) {
  t.post({
    uri: '/find/users/' + tarzan._id + '?' + tarzan.cred,
    body: {
      promote: 'linked',
      linked: {to: 'patches', type: 'watch', limit: 2, sort: '_id', more: true, fields: 'name,visibility,photo,schema', linkFields: 'enabled', refs: {},
        linked: {from: 'messages', type: 'content', limit: 1, more: true, fields: 'schema,description,photo,_owner', refs: 'name,schema', linkFields: false},
        linkCount: [
          {from: 'users', type: 'watch'},
          {from: 'users', type: 'like'},
        ],
      }
    },
  }, function(err, res, body) {
    t.assert(body.data.length)
    t.assert(body.parentCount === 1)
    t.assert(body.more)
    var cMoreMessages = 0
    body.data.forEach(function(patch) {
      t.assert(patch.schema === 'patch')
      t.assert(patch.name)
      t.assert(patch._owner)
      t.assert(patch.owner)
      t.assert(patch.owner.name)
      if (patch._owner != util.adminId) t.assert(patch.owner.photo)
      t.assert(patch.linkCount)
      t.assert(patch.linkCount.from)
      t.assert(patch.linkCount.from.users)
      t.assert(tipe.isDefined(patch.linkCount.from.users.like))
      t.assert(tipe.isDefined(patch.linkCount.from.users.watch))
      t.assert(tipe.isDefined(patch.linked))
      if (patch.moreLinked) {
        cMoreMessages++
      }
      patch.linked.forEach(function(message) {
        t.assert(message.schema === 'message')
        t.assert(message.owner)
        t.assert(message.owner.name)
        t.assert(!message.owner.photo)  // refs param for messages overrides outer refs def
      })
    })
    t.assert(cMoreMessages)
    t.assert(body.count === body.data.length)
    test.done()
  })
}


exports.findPatchforMessage = function(test) {
  t.post({
    uri: '/find/messages/me.tarzanToRiver' + seed + '?' + tarzan.cred,
    body: {
      refs: 'schema,name',
      linked: [
        {to: 'patches', type: 'content', limit: 1},
      ]
    }
  }, function(err, res, body) {
    t.assert(body.data.linked.length === 1)
    test.done()
  })
}


// Find messages for patches with new find syntax vs deprecated
// getEnitiesForEntity syntax
exports.findPatchMessagesCompareGetEntities = function(test) {

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
      refs: 'name,photo,schema',
      linked: [
        {to: 'patches', type: 'watch', limit: 30, fields: 'name,schema,visibility',
          linked: [
            {to: 'beacons', type: 'proximity', limit: 10},
            {to: 'places', type: 'proximity', fields: 'name,schema,category,photo', limit: 1},
            {from: 'messages', type: 'content', fields: 'schema,description', limit: 2},
          ],
          linkCount: [
            {from: 'messages', type: 'content'},
            {from: 'users', type: 'like'},
            {from: 'users', type: 'watch', filter: {enabled: true}},
          ]
        }
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

      // find returns tarzan on top with an array of linked patches.
      // Under each patch is an array of linked entities, of type beacon, place, or message,
      // and a linkCount object that counts messages, watches, and likes to the patch
      t.assert(rfind.linked.length === rge.length)
      var cMessagesTot = 0
      rfind.linked.forEach(function(patch) {
        var cMessagesPerPatch = 0
        t.assert(patch.schema === 'patch')
        t.assert(patch.linkCount)
        t.assert(tipe.isNumber(patch.linkCount.from.messages.content))
        t.assert(tipe.isNumber(patch.linkCount.from.users.watch))
        t.assert(tipe.isNumber(patch.linkCount.from.users.like))
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
        t.assert(patch.linksInCounts)
        t.assert(patch.linksInCounts.some(function(count) { return count.type === 'watch' }))
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

  t.get('/data/installs?q[_user]=' + tarzan._id + '&' + admin.cred,
  function(err, res, body) {
    t.assert(body.count === 1)
    var locTarzan = body.data[0].location
    t.assert(locTarzan)
    t.assert(locTarzan.lat === treehouse.location.lat)
    t.assert(locTarzan.lng === treehouse.location.lng)

    var location = {
      lat: treehouse.location.lat + distance,   // tarzan has moved
      lng: treehouse.location.lng + distance,
      accuracy: 20,
      provider: 'fused',
    }

    // Supported syntax
    t.post({
      uri: '/patches/near?' + tarzan.cred,
      body: {
        location: location,
        radius: 10000,
        install: 'in.' + tarzan._id,  // either install or installId will work
        limit: 50,
        linked: [
          {to: 'places', type: 'proxmity', sort: 'modifiedDate', limit: 1},
          {from: 'messages', type: 'content', sort: '-modifiedDate', limit: 2},
        ],
        linkCount: [
          {from: 'messages', type: 'content'},
          {from: 'users', type: 'like'},
          {from: 'users', type: 'watch'},
          {to: 'beacons', type: 'proximity'},
          {to: 'places', type: 'proximity'},
        ],
        links: [
          {to: 'beacons', type: 'proximity', limit: 10},
        ],
      }
    }, function(err, res, body) {

      var patches = body.data
      t.assert(patches.length === 4)
      t.assert(patches[0]._id = river._id)      // sorted by distance from query location
      t.assert(patches[1]._id = treehouse._id)
      t.assert(patches[2]._id = janehouse._id)
      t.assert(patches[3]._id = maryhouse._id)

      var cBeaconLinks = 0
      var cPlaceLinks = 0
      var cLinks = 0
      var cLinked = 0

      patches.forEach(function(patch) {
        t.assert(patch.linkCount)
        var lc = patch.linkCount
        t.assert(lc.from)
        t.assert(lc.from.messages)
        t.assert(tipe.isNumber(lc.from.messages.content))
        t.assert(lc.from.users)
        t.assert(tipe.isNumber(lc.from.users.like))
        t.assert(tipe.isNumber(lc.from.users.watch))

        t.assert(lc.to)
        t.assert(lc.to.places)
        t.assert(lc.to.beacons)
        t.assert(tipe.isNumber(lc.to.places.proximity))
        t.assert(tipe.isNumber(lc.to.beacons.proximity))
        cBeaconLinks += patch.linkCount.to.beacons.proximity
        cPlaceLinks += patch.linkCount.to.places.proximity

        t.assert(patch.linked)
        t.assert(tipe.isNumber(patch.linked.length))
        cLinked += patch.linked.length

        t.assert(patch.links)
        t.assert(tipe.isNumber(patch.links.length))
        cLinks += patch.links.length

      })

      t.assert(cBeaconLinks)
      t.assert(cPlaceLinks)
      t.assert(cLinks)
      t.assert(cLinked)

      // Check to see that running a near query updated Tarzan's install
      // record to a new location
      t.get('/data/installs?q[_user]=' + tarzan._id + '&' + admin.cred,
      function(err, res, body) {
        t.assert(body.count === 1)
        var locTarzanNew = body.data[0].location
        t.assert(locTarzanNew)
        t.assert(locTarzanNew.lat === location.lat)
        t.assert(locTarzanNew.lng === location.lng)

        // Deprecated syntax
        t.post({
          uri: '/patches/near?',
          body: {
            rest: false,  // Same as getEntities: true
            location: location,
            radius: 10000,
            installId: 'in.' + tarzan._id,
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
          var cLinksIn = 0, cLinksOut = 0, cLinksInCounts = 0, cLinksOutCounts = 0
          patchesGe.forEach(function(patch) {
            t.assert(patch._id)
            if (patch.linksIn) cLinksIn += patch.linksIn.length
            if (patch.linksOut) cLinksOut += patch.linksOut.length
            if (patch.linksInCounts) cLinksInCounts += patch.linksInCounts
            if (patch.linksOutCounts) cLinksOutCounts += patch.linksOutCounts
          })
          t.assert(cLinksIn)
          t.assert(cLinksOut)
          t.assert(cLinksInCounts)
          t.assert(cLinksOutCounts)
          // TODO: note this was done anonymously from tarzan's device,
          // Check to make sure that his install record was updated even
          // though he was not signed in.
          test.done()
        })
      })
    })
  })
}


exports.tarzanCanLikeAndUnlikeQuickly = function(test) {
  var riverLike = {
    _from: tarzan._id,
    _to: river._id,
    type: 'like',
  }
  t.post({
    uri: '/data/links?' + tarzan.cred,
    body: {data: riverLike, test: true},
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.data)
    t.assert(body.data._id)
    t.delete({uri: '/data/links/' + body.data._id + '?' + tarzan.cred},
    function(err, res, body) {
      t.assert(body.count === 1)
      t.post({
        uri: '/data/links?' + tarzan.cred,
        body: {data: riverLike, test: true},
      }, 201, function(err, res, body) {
        t.assert(body.count === 1)
        test.done()
      })
    })
  })
}


exports.likingAPatchUpdatesActivityDateOfUserAndPatch = function(test) {
  t.get('/data/users/' + jane._id,
  function(err, res, body) {
    t.assert(body.data)
    var janeOldActivityDate = body.data.activityDate
    t.get('/data/patches/' + treehouse._id,
    function(err, res, body) {
      t.assert(body.data)
      var treehouseOldActivityDate = body.data.activityDate

      setTimeout(likeTreehouse, 1200)  // activity date window is 1000

      function likeTreehouse() {

        t.post({
          uri: '/data/links?' + jane.cred,
          body: {data: {_to: treehouse._id, _from: jane._id, type: 'like', }, test: true, }
        }, 201, function(err, res, body) {

          // Test that Jane's activity date was updated
          t.get('/data/users/' + jane._id,
          function(err, res, body) {
            t.assert(body.data.activityDate > janeOldActivityDate)
            t.get('/data/patches/' + treehouse._id,

            // Test the treehouse's activity date was updated
            function(err, res, body) {
              t.assert(body.data.activityDate > treehouseOldActivityDate)
              treehouseNewActivityDate = body.data.activityDate

              // Test that updating a patch does not update its activity date
              t.post({
                uri: '/data/patches/' + treehouse._id + '?' + tarzan.cred,
                body: {data: {description: 'A nice place to swing'}, test: true},
              }, function(err, res, body) {
                t.get('/data/patches/' + treehouse._id + '?' + tarzan.cred,
                function(err, res, body) {
                  t.assert(body.data)
                  t.assert(body.data.activityDate === treehouseNewActivityDate)
                  t.assert(!body.notifications)  // Updates to content do not trigger notifications
                  test.done()
                })
              })
            })
          })
        })
      }
    })
  })
}


exports.deleteUserEraseOwnedWorks = function(test) {

  // Count mary's patches and messages
  t.get('/data/patches/count?q[_owner]=' + mary._id + '&' + mary.cred,
  function(err, res, body) {
    t.assert(body.count === 1)   // Mary has made one patch
    var cPatches = body.count

    t.get('/data/messages/count?q[_owner]=' + mary._id + '&' + mary.cred,
    function(err, res, body) {
      t.assert(body.count === 3)
      var cMessages = body.count  // Mary has sent 3 messages

      t.get('/data/sessions/count?q[_owner]=' + mary._id + '&' + admin.cred,
      function(err, res, body) {
        t.assert(body.count === 1)
        var cSessions = body.count  // Mary has an active session

        t.get('/data/installs/count?q[_user]=' + mary._id + '&' + admin.cred,
        function(err, res, body) {
          t.assert(body.count === 1)
          var cInstalls = body.count  // Mary has an active session

          // Custom app api that erases owned patches and messages
          t.del({uri: '/user/' + mary._id + '?erase=true&' + mary.cred},
          function(err, res, body) {
            t.assert(body.count === 1)

            // Erased is an object that tells how many owned entities were deleted
            t.assert(body.erased)
            t.assert(body.erased.patches === cPatches)
            t.assert(body.erased.messages === cMessages)
            t.assert(body.erased.sessions === cSessions)
            t.assert(body.erased.installs === cInstalls)

            // Now confirm that Mary and all her patches and messages are gone
            t.get('/data/users/' + mary._id + '?' + admin.cred,
            function(err, res, body) {
              t.assert(body.count === 0)  // mary is gone
              t.get('/data/patches?query[_owner]=' + mary._id + '&' + admin.cred,
              function(err, res, body) {
                t.assert(body.count === 0)  // mary's patches are gone
                t.get('/data/messages?q[_owner]=' + mary._id + '&' + admin.cred,
                function(err, res, body) {
                  t.assert(body.count === 0) // mary's messages are gone
                  t.get('/data/installs?q[_user]=' + mary._id + '&' + admin.cred,
                  function(err, res, body) {
                    t.assert(body.count === 0) // mary's installs are gone
                    t.get('/data/sessions?q[_owner]=' + mary._id + '&' + admin.cred,
                    function(err, res, body) {
                      t.assert(body.count === 0) // mary's installs are gone
                      test.done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
}


exports.addLotsOfPatchesNearby = function(test) {
  var patches = []
  for (var i = 0; i < 50; i++) {
    var nudge = distance * i
    var patch = {
      name: 'testPatch_' + seed + '_' + i,
      location: {
        lat: lat + nudge,
        lng: lng + nudge,
      },
      photo: photo,
    }
    patches.push(patch)
  }
  async.eachSeries(patches, postPatch, function(err) {
    t.assert(!err)
    test.done()
  })
  function postPatch(patch, next) {
    t.post({
      uri: '/data/patches?' + jane.cred,
      body: {data: patch},
    }, 201, function(err, res, body) {
      t.assert(body.data && body.data._id)
      next()
    })
  }
}


exports.addLotsOfMessagesToAPatch = function(test) {
  var messages = []
  for (var i = 0; i < 100; i++) {
    var message = {
      description: 'Test message ' + seed + '_' + i,
      links: [{_to: treehouse._id, type: 'content'}],
    }
    messages.push(message)
  }
  t.assert(messages.length === 100)
  async.eachSeries(messages, postMessage, function(err) {
    t.assert(!err)
    test.done()
  })
  function postMessage(msg, next) {
    var poster
    switch (i % 2) {
      case 0: poster = tarzan; break;
      case 1: poster = jane; break;
    }
    t.post({
      uri: '/data/messages?' + poster.cred,
      body: {data: msg},
    }, 201, function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._id)
      t.assert(body.data._owner === poster._id)
      t.assert(body.data.links)
      t.assert(body.data.links.length === 1)
      next()
    })
  }
}


exports.iosPatchesNearbyQuery = function(test) {
  t.post({
    uri: '/patches/near?' + jane.cred,
    body: {
      location: { lat: treehouse.location.lat, lng: treehouse.location.lng },
      skip: 0,
      radius: 10000,
      linked:
       [ { to: 'places',
           fields: '_id,name,photo,schema,type',
           type: 'proximity' },
         { fields: '_id,name,photo,schema,type',
           from: 'users',
           type: 'create' } ],
      more: false,
      limit: 50,
      links:
       [ { from: 'users',
           fields: '_id,type,schema',
           filter: { _from: jane._id },
           type: 'like' },
         { from: 'users',
           fields: '_id,type,enabled,mute,schema',
           filter: { _from: jane._id},
           type: 'watch' },
         { limit: 1,
           from: 'messages',
           fields: '_id,type,schema',
           filter: { _creator: jane._id},
           type: 'content' } ],
      rest: true,
      linkCount:
       [ { from: 'messages', type: 'content' },
         { from: 'users', type: 'like' },
         { enabled: true, from: 'users', type: 'watch' } ],
    },
  }, function(err, res, body) {
    t.assert(body.data && body.data.length === 50)
    test.done()
  })
}


exports.iosPatchDetailQuery = function(test) {
  t.post({
    uri: '/find/patches/' + treehouse._id + '?' + jane.cred,
    body: {
      promote: 'linked',
      linked: {
         limit: 50,
         from: 'messages',
         links: [{
           from: 'users',
           fields: '_id,type,schema',
           filter: {_from: jane._id},
           type: 'like'
         }],
         skip: 0,
         linkCount: [{from: 'users', type: 'like'}],
         linked: [{
            limit: 1,
            to: 'patches',
            fields: '_id,name,photo,schema,type',
            type: 'content',
          },{
            fields: '_id,name,photo,schema,type',
            from: 'users',
            type: 'create'
          },{
            limit: 1,
            to: 'messages',
            linked: [{
              fields: '_id,name,photo,schema,type',
              from: 'users',
              type: 'create'
            }],
            type: 'share',
          }, {
            linkCount: [
              {enabled: true, from: 'users', type: 'watch'},
              {from: 'messages', type: 'content' }
            ],
            limit: 1,
            to: 'patches',
            type: 'share'
          }, {
            to: 'users', limit: 5, type: 'share'
          }],
         more: true,
         type: 'content'
      },
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === 50)
    test.done()
  })
}
