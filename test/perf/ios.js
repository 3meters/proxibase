/**
 *  Patchr ios perf test
 *
 *  This tests standard queries called by the ios client.
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
var perf = {}


// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var place
var patch
var patch2
var loc
var patches
var user

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


exports.patchesNearSimple = function(test) {
  var tag = 'patchesNearSimple'
  t.post({
    tag: tag,
    uri: '/patches/near?' + user.cred,
    body: {
      location: loc,
      radius: 10000,
      more: true,
    },
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 20)
    patch = body.data[0]
    logPerf(perf, tag, body)
    test.done()
  })
}


// This query skips all info not required to diplay the near list itself
// When a user drills in on a patch, a second query must be fired to
// display the details of the patch.
exports.iosPatchesNearFast = function(test) {
  var tag = 'iosPatchesNearFast'
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      tag: tag,
      location: loc,
      skip: 0,
      radius: 10000,
      more: true,
      limit: 50,
      refs: {_creator: '_id,name,photo,schema,type'},
      // Alt syntax: refs: {_creator: {_id:1,name:1,photo:1,schema:1}},
      linkCounts: [
        { from: 'messages', type: 'content' },
        { from: 'users', type: 'watch', enabled: true },
      ],
    },
  }, function(err, res, body) {
    var patches = body.data
    t.assert(patches && patches.length)
    patches.forEach(function(patch) {
      t.assert(patch.linkCounts && patch.linkCounts.length)
      t.assert(patch.linkCounts[0].count)
      t.assert(patch.linkCounts[1].count)
    })
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosPatchesNear = function(test) {
  // Last checked ios build 108
  var tag = 'iosPatchesNear'
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      tag: 'tag',
      location: loc,
      skip: 0,
      radius: 10000,
      more: false,
      limit: 50,
      rest: true,
      refs: { _creator: '_id,name,photo,schema,type' },
      links: [
        { from: 'users',
          type: 'watch',
          filter: { _from: user._id},
          fields: '_id,type,enabled,mute,schema', },
        { limit: 1,
          from: 'messages',
          type: 'content',
          filter: { _creator: user._id},
          fields: '_id,type,schema', },
      ],
      linkCounts: [
        {from: 'messages', type: 'content'},
        {from: 'users', type: 'watch', enabled: false,},
        {from: 'users', type: 'watch', enabled: true,},
      ],
    },
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    body.data.forEach(function(p) {
      // find a private patch owned by someone else
      if ((p._owner !== user._id) && (p.visibility === 'private')) {
        if (!patch) patch = p  // module global
        else patch2 = p
      }
      if (patch && patch2) return
    })
    t.assert(patch)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosPatchDetailFast= function(test) {
  var tag = 'iosPatchDetailFast'
  t.post({
    uri: '/find/patches/' + patch._id + '?' + user.cred,
    body: {
      tag: tag,
      promote: 'linked',
      linkCounts: [{from: 'users', type: 'watch', enabled: true}],
      links: [{from: 'users', type: 'watch', filter: {_from: user._id}, limit: 1, fields: '_id,type,schema,enabled,mute' }],
      linked: {from: 'messages', type: 'content', limit: 50, skip: 0, more: true, refs: {_owner: '_id,name,photo,schema'},
        // Has this user liked this message or not
        links: [{from: 'users', type: 'like', filter: {_from: user._id}, limit: 1, fields: '_id,type,schema' }],
        // How many users have liked this message
        linkCounts: [{from: 'users', type: 'like'}],
      },
    },
  }, function(err, res, body) {
    t.assert(body.parentEntity)
    var p = body.parentEntity
    t.assert(p._id === patch._id)
    t.assert(p.name === patch.name)
    t.assert(p.links)
    t.assert(p.links.length === 1)
    var watchLink = p.links[0]
    t.assert(watchLink.enabled)
    // messages
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    var cMessageLikesOld = 0
    var cMessageLikes = 0
    var cMessageLikesByUser = 0
    body.data.forEach(function(msg) {
      t.assert(msg.owner)
      t.assert(msg.owner._id)
      t.assert(msg.owner.name)
      t.assert(msg.owner.photo)
      t.assert(msg.owner.schema === 'user')
<<<<<<< HEAD
      t.assert(msg.linkCounts && msg.linkCounts.length === 1)
=======
      t.assert(msg.linkCounts)
      t.assert(msg.linkCounts.length === 1)
>>>>>>> dev
      cMessageLikes += msg.linkCounts[0].count
      t.assert(tipe.isArray(msg.links))  // true if I have liked this message
      cMessageLikesByUser += msg.links.length
    })
    t.assert(cMessageLikes)
    t.assert(cMessageLikesByUser)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosPatchDetail = function(test) {
  // Manually inspected calls from ios build 108
  var tag = 'iosPatchDetail'
  t.post({
    uri: '/find/patches/' + patch._id + '?' + user.cred,
    body: {
      tag: tag,
      links: [
        {
          from: 'users',
          type: 'watch',
          filter: {_from: user._id},
          fields: '_id,type,enabled,mute,schema',
        },
        {
          from: 'messages',
          type: 'content',
          filter: { _creator: user._id},
          limit: 1,
          fields: '_id,type,schema',
        }
      ],
      linkCounts: [
        {from: 'messages', type: 'content' },
        {enabled: true, from: 'users', type: 'watch' },
        {enabled: false, from: 'users', type: 'watch' },
      ],
      refs: {_creator: '_id,name,photo,schema,type'},
    }
  }, function(err, res, body) {
    t.assert(body && body.data && body.data.links && body.data.links.length)
    logPerf(perf, tag, body)

    t.post({
      uri: '/find/patches/' + patch._id + '?' + user.cred,
      body: {
        tag: 'iosPatchDetail',
        promote: 'linked',
        linked: {from: 'messages', type: 'content', limit: 50, skip: 0, more: true,
          links: [{from: 'users', type: 'like', filter: {_from: user._id}, fields: '_id,type,schema' }],
          linkCounts: [{from: 'users', type: 'like'}],
          linked: [
            {to: 'patches', type: 'content', limit: 1,  fields: '_id,name,photo,schema,type'},
            {to: 'messages', type: 'share', limit: 1, refs: {_creator: '_id,name,photo,schema,type'}},
            {to: 'users', limit: 5, type: 'share' },
            {
              linkCounts: [
                {from: 'users', type: 'watch', enabled: true},
                {from: 'messages', type: 'content'}
              ],
              // wtf?
              limit: 1,
              to: 'patches',
              type: 'share',
            }
          ],
        },
      }
    }, function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data.length)
      logPerf(perf, tag, body)
      test.done()
    })
  })
}


exports.iosPatchesInterestingFast = function(test) {
  var tag = 'iosPatchesInterestingFast'
  t.post({
    uri: '/patches/interesting?' + user.cred,
    body: {
      tag: tag,
      location: loc,
      limit: 50,
      skip: 0,
      more: true,
      linked: [
       {to: 'places', fields: '_id,name,photo,schema,type', type: 'proximity', limit: 1 },
      ],
      linkCounts: [
        {from: 'messages', type: 'content' },
        {from: 'users', type: 'like' },
        {from: 'users', type: 'watch', enabled: true }
      ],
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}



exports.iosPatchesInteresting = function(test) {
  var tag = 'iosPatchesInteresting'
  t.post({
    uri: '/patches/interesting?' + user.cred,
    body: {
      tag: tag,
      location: loc,
      limit: 50,
      skip: 0,
      more: true,
      linked:
       [ { to: 'places', fields: '_id,name,photo,schema,type', type: 'proximity' },
         { fields: '_id,name,photo,schema,type', from: 'users', type: 'create' } ],
      links:
       [ { from: 'users', fields: '_id,type,schema', filter: { _from: user._id }, type: 'like' },
         { from: 'users', fields: '_id,type,enabled,mute,schema', filter: { _from: user._id }, type: 'watch' },
         { limit: 1, from: 'messages', fields: '_id,type,schema', filter: { _creator: user._id }, type: 'content' } ],
      linkCounts:
       [ { from: 'messages', type: 'content' },
         { from: 'users', type: 'like' },
         { enabled: true, from: 'users', type: 'watch' } ],
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    if (checkLengths) t.assert(body.data.length === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosUserDetailFast = function(test) {
  var tag = 'iosUserDetailFast'
  t.post({
    uri: '/find/users/' + user._id + '?' + user.cred,
    body: {
      tag: tag,
      promote: 'linked',
      linked: {
        to: 'messages',
        type: 'create',
        limit: 50,
        skip: 0,
        more: true,
        linkCounts: [
          { from: 'users', type: 'like'},
          { from: 'users', type: 'watch', enabled: true},
          { from: 'messages', type: 'content'},
        ],
      },
    },
  }, function(err, res, body) {
    t.assert(body.count)
    if (checkLengths) t.assert(body.count === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosUserDetail = function(test) {
  var tag = 'iosUserDetail'
  t.post({
    uri: '/find/users/' + user._id + '?' + user.cred,
    body: {
      tag: tag,
      promote: 'linked',
      linked: {
        to: 'messages',
        type: 'create',
        limit: 50,
        links:
        [ { from: 'users',
            fields: '_id,type,schema',
            filter: { _from: user._id},
            type: 'like' } ],
        skip: 0,
        linkCounts: [ { from: 'users', type: 'like' } ],
        linked:
        [ { to: 'patches', type: 'content', limit: 1,  fields: '_id,name,photo,schema,type', },
          { from: 'users', type: 'create', fields: '_id,name,photo,schema,type'  },
          { to: 'messages', type: 'share', limit: 1, linked:
             [ { from: 'users', type: 'create', fields: '_id,name,photo,schema,type', } ],
            },
          { linkCounts:
             [ { enabled: true, from: 'users', type: 'watch' },
               { from: 'messages', type: 'content' } ],
            limit: 1, to: 'patches', type: 'share' },
          { to: 'users', limit: 5, type: 'share' } ],
        more: true,
      }
    }
  }, function(err, res, body) {
    t.assert(body.count)
    if (checkLengths) t.assert(body.count === 50)
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.iosUserFeed = function (test) {
  var tag = 'iosUserFeed'
  t.post({
    tag: tag,
    uri: '/user/getNotifications?limit=50&' + user.cred,
    body: {
      limit: 50,
      more: true,
      skip: 0,
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count)
    if (checkLengths) t.assert(body.count === 50)
    var prev = Infinity
    body.data.forEach(function(item) {
      t.assert(item.modifiedDate)
      t.assert(item.modifiedDate <= prev)
      prev = item.modifiedDate
    })
    logPerf(perf, tag, body)
    test.done()
  })
}


exports.printPerf = function(test) {
  lib.printPerf('ios', perf)
  test.done()
}
