/**
 *  Patchr perf test
 *
 *  This tests standard queries called by the client.
 *  It is intended to run against a pre-populated db
 *  created by the ../gen test.
 *
 *  To run stand-alone:
 *
 *     cd $SRC/test
 *     node test -t perf
 *
 *  Safe to run concurrently simulating real use
 *
 */


var async = require('async')
var util = require('proxutils')
var seed
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.safeDb   // raw mongodb connection object without mongoSafe wrapper
var admin = {}
var _exports = {}  // For commenting out tests


// Generate a random location on earth based on seeds 1 and 2
// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var place
var patch
var loc
var patches
var user
var seed


exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    admin._id = session._owner
    admin.cred = 'user=' + session._owner +
        '&session=' + session.key + '&install=' + seed
    test.done()
  })
}

exports.findARandomPlace = function(test) {
  t.get('/find/places/count',
  function(err, res, body) {
    t.assert(body && body.count)
    var i = Math.floor(Math.random() * body.count)
    t.get('/find/places?sort=_id&limit=1&skip=' + i,
    function(err, res, body) {
      t.assert(body && body.data && body.data.length === 1)
      place = body.data[0]                    // module global
      t.assert(place._id && place.location)
      loc = _.cloneDeep(place.location)       // module global
      test.done()
    })
  })
}


exports.findARandomUser = function(test) {
  t.post({
    uri: '/find/places/' + place._id + '?' + admin.cred,
    body: {
      linked: {
        to: 'beacons', type: 'proximity', limit: 1, linked: {
          from: 'patches', type: 'proximity', limit: 1, linked: {
            from: 'users', type: 'create', limit: 1
          }
        }
      },
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.schema === 'place')
    t.assert(body.data.linked && body.data.linked.length)
    var beacon = body.data.linked[0]
    t.assert(beacon.schema === 'beacon')
    t.assert(beacon.linked && beacon.linked.length)
    var patch = beacon.linked[0]
    t.assert(patch.schema === 'patch')
    t.assert(patch.linked && patch.linked.length)
    user = patch.linked[0]  // module global
    t.assert(user.schema === 'user')
    t.assert(user.email)    // becauase we are signed in as admin
    test.done()
  })
}


exports.signInAsRandomUser = function(test) {
  t.get('/find/installs?q[_user]=' + user._id + '&' + admin.cred,
  function(err, res, body) {
    t.assert(body.data && body.data.length)
    // users can have more than one install, but we only need one for this test
    user.installId = body.data[0].installId
    t.assert(user.installId)
    t.post({
      uri: '/auth/signin',
      body: {
        email: user.email,
        password: '123456',  // To match password set in ../gen
        installId: user.installId,
      }
    }, function(err, res, body) {
      t.assert(body.user)
      t.assert(body.session)
      t.assert(body.credentials)
      user.cred = 'user=' + body.credentials.user + '&session=' + body.credentials.session
      test.done()
    })
  })
}


exports.iosPatchesNearbyQuery = function(test) {
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      location: loc,
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
           filter: { _from: user._id },
           type: 'like' },
         { from: 'users',
           fields: '_id,type,enabled,mute,schema',
           filter: { _from: user._id},
           type: 'watch' },
         { limit: 1,
           from: 'messages',
           fields: '_id,type,schema',
           filter: { _creator: user._id},
           type: 'content' } ],
      rest: true,
      linkCount:
       [ { from: 'messages', type: 'content' },
         { from: 'users', type: 'like' },
         { enabled: true, from: 'users', type: 'watch' } ],
    },
  }, function(err, res, body) {
    t.assert(body.data && body.data.length === 50)
    body.data.forEach(function(p) {
      // find a private patch owned by someone else
      if ((p._owner !== user._id) && (p.visibility === 'private')) {
        patch = p  // module global
        return
      }
    })
    t.assert(patch)
    test.done()
  })
}


exports.iosPatchDetailQuery = function(test) {
  t.post({
    uri: '/find/patches/' + patch._id + '?' + user.cred,
    body: {
      promote: 'linked',
      linked: {
         limit: 50,
         from: 'messages',
         links: [{
           from: 'users',
           fields: '_id,type,schema',
           filter: {_from: user._id},
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
    test.done()
  })
}

exports.getUserFeed = function (test) {
  t.get('/user/getNotifications?limit=50&' + user.cred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 50)
    test.done()
  })
}

exports.iosNearAgain = function(test) {
  exports.iosPatchesNearbyQuery(test)
}

exports.iosPatchDetailAgain = function(test) {
  exports.iosPatchDetailQuery(test)
}
