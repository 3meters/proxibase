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
var user
var seed
var lat
var lng


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
      place = body.data[0]
      t.assert(place._id && place.location)
      test.done()
    })
  })
}


_exports.iosPatchesNearbyQuery = function(test) {
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



_exports.iosPatchDetailQuery = function(test) {
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
