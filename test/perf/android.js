/**
 *  Patchr andriod perf test
 *
 *  This tests standard queries called by the Android client.
 *  It is intended to run against a pre-populated db
 *  created by the ../gen test.
 *
 *  To run stand-alone:
 *
 *     cd $SRC/test
 *     node test -t perf -c cperf.js
 *
 *  Safe to run concurrently simulating real use
 *
 */


var qs = require('querystring')
var util = require('proxutils')
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var admin = {}
var _exports = {}          // For commenting out tests
var checkLengths = true    // When using a small test database, set to false skip length checks

var lib = require('./lib')
var logPerf = lib.logPerf


// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var place
var patch
var patch2
var loc
var patches
var user

var perf = {}

exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    admin._id = session._owner
    admin.cred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


// Set module globals
exports.setupTest = function(test) {
  lib.setup(testUtil.db, function(err, params) {
    t.assert(!err, err)
    t.assert(params && params.place)
    place = params.place
    loc = params.loc
    user = params.user
    test.done()
  })
}


exports.signInAsRandomUser = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {
      email: user.email,
      password: '123456',  // To match password set in ../gen
      installId: user.installId,
    }
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.credentials)
    user.cred = qs.stringify(body.credentials)
    test.done()
  })
}


exports.patchesNearBaseLine = function(test) {
  var tag = 'patchesNearBaseline'
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      tag: tag,
      location: loc,
      getEntities: true,
      skip: 0,
      radius: 10000,
      more: false,
      limit: 50,
    },
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    patch = body.data[0]
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.androidPatchesNearFast = function(test) {
  var tag = 'patchesNearIdeal'
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      tag: tag,
      alt: true,
      radius: 10000,
      rest: false,
      limit: 50,
      location: loc,
      links: {
        shortcuts: false,
        active: [
          {count: true, schema: 'message', type: 'content', direction: 'in'},
          {count: true, schema: 'user', type: 'watch', direction: 'in'},
        ],
      },
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    body.data.forEach(function(patch) {
      t.assert(patch.linksInCounts && patch.linksInCounts.length)
      patch.linksInCounts.forEach(function(count) {
        t.assert(count.count)
      })
    })
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.androidPatchesNear = function(test) {
  // Confirmed with Android build 101
  var tag = 'patchesNearBuild101'
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      tag: tag,
      radius: 10000,
      rest: false,
      limit: 50,
      location: loc,
      links: {
        shortcuts: true,
        active:
        [
          { links: true, count: true, schema: 'beacon', type: 'proximity', limit: 10, direction: 'out' },
          { where: { _from: user._id },
            links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in' },
          { where: { _creator: user._id },
            links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in' },
        ]
      },
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    body.data.forEach(function(p) {
      // find a private patch owned by someone else
      if ((p._owner !== user._id) && (p.visibility === 'private')) {
        patch2 = p  // module global
        return
      }
    })
    t.assert(patch)
    // log('android patch', patch)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.androidPatchDetail = function(test) {

  var tag = 'patchDetailBuild101'
  // Android build 101 measured 1/14/16
  t.post({
    uri: '/do/getEntitiesForEntity?' + user.cred,
    body: {
      tag: tag,
      entityId: patch2._id,
      cursor: {
        where: { enabled: true },
        schemas: [ 'message' ],
        linkTypes: [ 'content' ],
        direction: 'in',
        limit: 50,
        skip: 0,
        sort: { modifiedDate: -1 },
      },
      links: {
        shortcuts: true,
        active: [
          { links: true, count: true, schema: 'patch', type: 'content', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'patch', type: 'share', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'message', type: 'share', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'user', type: 'share', limit: 5, direction: 'out' },
          { where: { _from: user._id },
              links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in' },
        ],
      }
    }
  }, function(err, res, body) {
    t.assert(body.entity)  // patch
    t.assert(body && body.data && body.data.length) // messages
    if (checkLengths) t.assert(body.data.length === 50) // messages
    var m = body.data[0]   // message
    t.assert(m.linksOut && m.linksOut.length)
    logPerf(perf, tag, body)

    // Second call android client sends to paint patch detail, build 101, 1/14/16
    t.post({
      uri: '/do/getEntities?' + user.cred,
      body: {
        tag: tag,
        entityIds: [patch2._id],
        links: {
          shortcuts: true,
          active: [
            {links: true, count: true, schema: 'beacon', type: 'proximity', limit: 10, direction: 'out'},
            {where: {_from: user._id}, links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in'},
            {where: {_creator: user._id}, links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in'}
          ],
        },
      }
    }, function(err, res, body) {
      logPerf(perf, tag, body)
      test.done()
    })
  })
}


exports.androidPatchesInteresting = function(test) {
  var tag = 'patchesInteresting'
  t.post({
    uri: '/patches/interesting?' + user.cred,
    body: {
      tag: tag,
      getEntities: true,
      limit: 50,
      links: {
        shortcuts: false,
        active: [
          {where: {_from: user._id}, links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in'},
          {where: {_creator: user._id}, links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in'}
        ]
      },
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.androidUserDetail = function(test) {
  var tag = 'userDetail'
  t.post({
    uri: '/do/getEntitiesForEntity?' + user.cred,
    body: {
      tag: tag,
      entityId: user._id,
      cursor: {
        where: { enabled: true },
        skip: 0,
        sort: { modifiedDate: -1 },
        schemas: [ 'message' ],
        limit: 50,
        linkTypes: [ 'create' ],
        direction: 'out'
      },
      links: {
        shortcuts: true,
        active: [
          { links: true, count: true, schema: 'patch', type: 'content', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'patch', type: 'share', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'message', type: 'share', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'user', type: 'share', limit: 5, direction: 'out' },
          { where: { _from: 'us.130820.80231.131.599884' },
            links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in' }
        ]
      }
    }
  }, function(err, res, body) {
    t.assert(body && body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    t.assert(body.entity)
    t.assert(body.more)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.andoidUserFeed = function(test) {
  var tag = 'userFeed'
  // Not verified
  t.post({
    uri: '/user/getNotifications?' + user.cred,
    body: {
      tag: tag,
      entityId: user._id,
      cursor: {
        limit: 50,
        skip: 0,
      }
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}

exports.printPerf = function(test) {
  lib.printPerf('android', perf)
  test.done()
}
