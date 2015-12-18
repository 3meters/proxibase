/**
 *  Proxibase linkstat test
 */


var async = require('async')
var util = require('proxutils')
var seed = util.seed(6)  // for running tests concurrently
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.safeDb   // raw mongodb connection object without mongoSafe wrapper
var admin = {}
var _exports = {}  // For commenting out tests


var bob = {
  _id: 'us.ls_bob' + seed,
  name: 'ls_bob' + seed,
  email: 'ls_bob' + seed + '@3meters.com',
  password: 'foobar',
}

var jane = {
  _id: 'us.ls_jane' + seed,
  name: 'ls_jane' + seed,
  email: 'ls_jane' + seed + '@3meters.com',
  password: 'foobar',
}

var house = {
  _id: 'pa.ls_house' + seed,
  name: 'Ls_House' + seed,
}

var janeWatchesHouse = 'li.ls_janeWatchesHouse' + seed


exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    admin._id = session._owner
    admin.cred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


exports.createUsers = function(test) {
  t.post({
    uri: '/user/create',
    body: {
      data: bob,
      secret: 'larissa',
    }
  }, function(err, res, body) {
    t.assert(body.user && body.user._id)
    bob.role = body.user.role
    t.assert(body.session && body.session.key)
    bob.cred = 'user=' + bob._id + '&session=' + body.session.key
    t.post({
      uri: '/user/create',
      body: {
        data: jane,
        secret: 'larissa',
      }
    }, function(err, res, body) {
      t.assert(body.user && body.user._id)
      jane.role = body.user.role
      t.assert(body.session && body.session.key)
      jane.cred = 'user=' + jane._id + '&session=' + body.session.key
      test.done()
    })
  })
}


exports.houseLinkstatsDoNotExist = function(test) {
  t.get('/find/linkstats?q[_to]=' + house._id,
  function(err, res, body) {
    t.assert(body.data && body.data.length === 0)
    test.done()
  })
}


exports.createPatch = function(test) {
  // Bob creates public house patch
  t.post({
    uri: '/data/patches?' + bob.cred,
    body: {data: house, test: true},
  }, 201, function (err, res, body) {
    t.assert(body.count === 1)
    test.done()
  })
}

exports.linkStatsBasicWorks = function(test) {
  t.get('/find/linkstats?q[_to]=' + house._id + '&q[type]=create',
  function(err, res, body) {
    t.assert(body.data && body.data.length === 1)
    t.assert(body.data[0].count === 1)

    t.get('/find/linkstats?q[_to]=' + house._id + '&q[type]=watch',
    function(err, res, body) {
      t.assert(body.data && body.data.length === 1)
      t.assert(body.data[0].count === 1)

      // Check with post and that enabled is set
      t.post({
        uri: '/find/linkstats',
        body: {query: {
          _to:      house._id,
          type:     'watch',
          enabled:  true,
        }},
      }, function(err, res, body) {
        t.assert(body.data && body.data.length === 1)
        t.assert(body.data[0].count === 1)
        test.done()
      })
    })
  })
}


exports.watchingPatchIncrementsStatCount = function(test) {
  t.post({
    uri: '/data/links?' + jane.cred,
    body: {
      data: {
        _id:    janeWatchesHouse,
        _from:  jane._id,
        _to:    house._id,
        type:   'watch',
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._owner === bob._id)
    t.assert(body.data._creator === jane._id)
    t.assert(body.data.enabled === true)

    t.post({
      uri: '/find/linkstats',
      body: {
        query: {
          _to: house._id,
          type: 'watch',
          enabled: true,
        }
      }
    }, function(err, res, body) {
      t.assert(body.data && body.data.length === 1)
      t.assert(body.data[0].count === 2)
      test.done()
    })
  })
}


exports.updatingLinksIncrementsAndDecrementsStats = function(test) {
  t.post({
    uri: '/data/links/' + janeWatchesHouse + '?' + bob.cred,
    body: {
      data: {
        enabled: false
      }
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._owner === bob._id)
    t.assert(body.data._creator === jane._id)
    t.assert(body.data.enabled === false)

    t.post({
      uri: '/find/linkstats',
      body: {
        query: {
          _to: house._id,
          type: 'watch',
          enabled: true,
        }
      }
    }, function(err, res, body) {
      t.assert(body.data && body.data.length === 1)
      t.assert(body.data[0].count === 1)  // decrement works

      t.post({
      uri: '/find/linkstats',
        body: {
          query: {
            _to: house._id,
            type: 'watch',
            enabled: false,  // now false
          }
        }
      }, function(err, res, body) {
        t.assert(body.data && body.data.length === 1)
        t.assert(body.data[0].count === 1)  // create new works
        test.done()
      })
    })
  })
}


exports.removeLastLinkRemovesStat = function(test) {
  t.del({
    uri: '/data/links/' + janeWatchesHouse + '?' + jane.cred
  }, function(err, res, body) {
    t.assert(body.count === 1)

    t.post({
      uri: '/find/linkstats',
      body: {
        query: {
          _to: house._id,
          type: 'watch',
          enabled: false,
        }
      }
    }, function(err, res, body) {
      t.assert(body.data && body.data.length === 0)  // gone
      test.done()
    })
  })
}


exports.rebuildStatsRuns = function(test) {
  t.get('/admin/linkstats/rebuild?' + admin.cred,
  function(err, res, body) {
    test.done()
  })
}


exports.afterRebuildBasicProducesTheSameResults = function(test) {
  exports.linkStatsBasicWorks(test)
}
