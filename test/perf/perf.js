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
var qs = require('querystring')
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
var patch2
var loc
var patches
var user
var seed

user = {
  _id: 'us.151116.32833.114.625031',
  credentials: {
    user: 'us.151116.32833.114.625031',
    session: '963c4eb6e986123a8c0c5fc614b6cbc9a360563a',
    install: '66972987',
  },
  cred: 'user=us.151116.32833.114.625031&session=963c4eb6e986123a8c0c5fc614b6cbc9a360563a&install=66972987',
}

loc = {
  lat: -88.89793416,
  lng: 92.60602406,
}

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
  t.get('/find/users/' + user._id + '?' + admin.cred,
  function(err, res, body) {
    t.assert(body && body.data)
    user = body.data
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
        t.assert(body.credentials)
        user.cred = qs.stringify(body.credentials)
        test.done()
      })
    })
  })
}


exports.patchesNearMinimum = function(test) {
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      location: loc,
      skip: 0,
      radius: 10000,
      more: false,
      limit: 50,
    },
  }, function(err, res, body) {
    //  t.assert(body.data && body.data.length === 50)
    t.assert(body.data && body.data.length)
    patch = body.data[0]
    test.done()
  })
}


exports.iosPatchesNear = function(test) {
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
        if (!patch) patch = p  // module global
        else patch2 = p
      }
      if (patch && patch2) return
    })
    t.assert(patch)
    // log('ios patch', patch)
    test.done()
  })
}


exports.iosPatchesNearAlt = function(test) {
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      alt: true,
      location: loc,
      skip: 0,
      radius: 10000,
      more: true,
      limit: 50,
      // other syntax: refs: {_owner: '_id,name,photo,schema'},
      refs: {_owner: {_id:1, name:1, photo:1, schema:1}},
      linked: [
        {to: 'places', type: 'proximity', limit: 1, fields: '_id,name,photo,schema,type'},
      ],
      linkCount: [
        { from: 'messages', type: 'content' },
        { from: 'users', type: 'watch', enabled: true },
      ],
    },
  }, function(err, res, body) {
    var patches = body.data
    t.assert(patches && patches.length)
    patches.forEach(function(patch) {
      t.assert(patch.linkCount)
      t.assert(patch.linkCount.from)
      t.assert(patch.linkCount.from.messages)
      t.assert(patch.linkCount.from.messages.content)
      t.assert(tipe.isNumber(patch.linkCount.from.messages.content))
      t.assert(patch.linkCount.from.users)
      t.assert(patch.linkCount.from.users.watch)
      t.assert(tipe.isNumber(patch.linkCount.from.users.watch))
      t.assert(patch.linked)
      t.assert(patch.linked.length === 1)
      t.assert(patch.linked[0].schema === 'place')
    })
    test.done()
  })
}


exports.iosPatchDetail = function(test) {
  t.post({
    uri: '/find/patches/' + patch._id + '?' + user.cred,
    body: {
      promote: 'linked',
      linked: {from: 'messages', type: 'content', limit: 50, skip: 0, more: true,
        links: [{from: 'users', type: 'like', filter: {_from: user._id}, fields: '_id,type,schema' }],
        linkCount: [{from: 'users', type: 'like'}],
        linked: [
          { to: 'users', type: 'share', limit: 5 },
          { to: 'patches', type: 'content', limit: 1,  fields: '_id,name,photo,schema,type',  },
          { from: 'users', type: 'create', fields: '_id,name,photo,schema,type', },
          { to: 'messages', type: 'share', limit: 1, linked:
            [{ from: 'users', type: 'create', fields: '_id,name,photo,schema,type', }], },
          { to: 'patches', type: 'share', limit: 1, linkCount: [  // WTF?
              {from: 'users', type: 'watch', enabled: true },
              {from: 'messages', type: 'content' },
            ],},
        ],
      },
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length)
    test.done()
  })
}


exports.iosPatchDetailAlt = function(test) {
  t.post({
    uri: '/find/patches/' + patch._id + '?' + user.cred,
    body: {
      alt: true,
      promote: 'linked',
      linkCount: [{from: 'users', type: 'watch', enabled: true}],
      links: [{from: 'users', type: 'watch', filter: {_from: user._id}, limit: 1, fields: '_id,type,schema,enabled,mute' }],
      linked: {from: 'messages', type: 'content', limit: 50, skip: 0, more: true, refs: {_owner: '_id,name,photo,schema'},
        // Has this user liked this message or not
        links: [{from: 'users', type: 'like', filter: {_from: user._id}, limit: 1, fields: '_id,type,schema' }],
        // How many users have liked this message
        linkCount: [{from: 'users', type: 'like'}],
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
    t.assert(body.data)
    t.assert(body.data.length)
    // t.assert(body.data.length === 50)
    var cMessageLikesOld = 0
    var cMessageLikes = 0
    var cMessageLikesByUser = 0
    body.data.forEach(function(msg) {
      t.assert(msg.owner)
      t.assert(msg.owner._id)
      t.assert(msg.owner.name)
      t.assert(msg.owner.photo)
      t.assert(msg.owner.schema === 'user')
      t.assert(msg.linkCount)
      t.assert(msg.linkCount.from)
      t.assert(msg.linkCount.from.users)
      t.assert(tipe.isNumber(msg.linkCount.from.users.like))
      cMessageLikesOld += msg.linkCount.from.users.like
      t.assert(msg.linkCounts)
      t.assert(msg.linkCounts.length === 1)
      cMessageLikes += msg.linkCounts[0].count
      t.assert(tipe.isArray(msg.links))  // true if I have liked this message
      cMessageLikesByUser += msg.links.length
    })
    t.assert(cMessageLikesOld)
    t.assert(cMessageLikes)
    t.assert(cMessageLikes === cMessageLikesOld)
    t.assert(cMessageLikesByUser)
    test.done()
  })
}


exports.iosPatchesInteresting = function(test) {
  t.post({
    uri: '/patches/interesting?' + user.cred,
    body: {
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
      linkCount:
       [ { from: 'messages', type: 'content' },
         { from: 'users', type: 'like' },
         { enabled: true, from: 'users', type: 'watch' } ],
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length === 50)
    test.done()
  })
}


exports.iosPatchesInterestingAlt = function(test) {
  t.post({
    uri: '/patches/interesting?' + user.cred,
    body: {
      alt: true,
      location: loc,
      limit: 50,
      skip: 0,
      more: true,
      linked: [
       {to: 'places', fields: '_id,name,photo,schema,type', type: 'proximity', limit: 1 },
      ],
      linkCount: [
        {from: 'messages', type: 'content' },
        {from: 'users', type: 'like' },
        {from: 'users', type: 'watch', enabled: true }
      ],
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length === 50)
    test.done()
  })
}


exports.iosUserDetail = function(test) {
  t.post({
    uri: '/find/users/' + user._id + '?' + user.cred,
    body: {
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
        linkCount: [ { from: 'users', type: 'like' } ],
        linked:
        [ { to: 'patches', type: 'content', limit: 1,  fields: '_id,name,photo,schema,type', },
          { from: 'users', type: 'create', fields: '_id,name,photo,schema,type'  },
          { to: 'messages', type: 'share', limit: 1, linked:
             [ { from: 'users', type: 'create', fields: '_id,name,photo,schema,type', } ],
            },
          { linkCount:
             [ { enabled: true, from: 'users', type: 'watch' },
               { from: 'messages', type: 'content' } ],
            limit: 1, to: 'patches', type: 'share' },
          { to: 'users', limit: 5, type: 'share' } ],
        more: true,
      }
    }
  }, function(err, res, body) {
    t.assert(body.count === 50)
    test.done()
  })
}



exports.iosUserDetailAlt = function(test) {
  t.post({
    uri: '/find/users/' + user._id + '?' + user.cred,
    body: {
      alt: true,
      promote: 'linked',
      linked: {
        to: 'messages',
        type: 'create',
        limit: 50,
        skip: 0,
        more: true,
        linkCount: [
          { from: 'users', type: 'like'},
          { from: 'users', type: 'watch', enabled: true},
          { from: 'messages', type: 'content'},
        ],
      },
    },
  }, function(err, res, body) {
    t.assert(body.count === 50)
    test.done()
  })
}


exports.androidPatchesNear = function(test) {
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      radius: 10000,
      rest: false,
      limit: 50,
      location: loc,
      links: {
        shortcuts: true,
        active:
        [ 
  
          { links: true, count: true, schema: 'beacon', type: 'proximity', limit: 10, direction: 'out' },
          { links: true, count: true, schema: 'place', type: 'proximity', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'message', type: 'content', limit: 2, direction: 'both' },
          { where: { _from: user._id },
            links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in' },
          { where: { _from: user._id },
            links: true, count: true, schema: 'user', type: 'like', limit: 1, direction: 'in' },
          { where: { _creator: user._id },
            links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in' }]
      },
    }
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
    // log('android patch', patch)
    test.done()
  })
}


exports.androidPatchesNearAlt = function(test) {
  t.post({
    uri: '/patches/near?' + user.cred,
    body: {
      alt: true,
      radius: 10000,
      rest: false,
      limit: 50,
      location: loc,
      links: {
        shortcuts: true,
        active: [
          { links: true, count: true, schema: 'place', type: 'proximity', limit: 1, direction: 'out' },
          { links: true, count: true, schema: 'message', type: 'content', limit: 1, direction: 'in' },
          { links: true, count: true, schema: 'user', type: 'watch', limit: 1, direction: 'in' },
        ],
      },
    }
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
    // log('android patch', patch)
    test.done()
  })
}


exports.androidPatchDetail = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + user.cred,
    body: {
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
    t.assert(body && body.data && body.data.length === 50) // messages
    var m = body.data[0]   // message
    t.assert(m.linksOut && m.linksOut.length)
    // log('android patch detail', body)
    test.done()
  })
}


exports.androidPatchDetailAlt = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + user.cred,
    body: {
      alt: true,
      entityId: patch2._id,
      cursor: {
        where: { enabled: true },
        schemas: [ 'message' ],
        linkTypes: [ 'content' ],
        direction: 'in',
        limit: 50,
        skip: 0,
        sort: { modifiedDate: -1 },
        refs: {_owner: '_id,name,photo,schema'},
      },
      links: {
        shortcuts: true,
        active: [
          { schema: 'user', type: 'like', direction: 'in', count: true,  },  // how many likes
          { schema: 'user', type: 'like', direction: 'in', where: {_from: user._id}, limit: 1,},  // has this user liked
        ],
      }
    }
  }, function(err, res, body) {
    t.assert(body.entity)  // patch
    t.assert(body && body.data && body.data.length === 50) // messages
    var m = body.data[0]   // message
    t.assert(m.owner)
    t.assert(m.owner.name)
    t.assert(m.owner.photo)
    t.assert(m.owner.schema === 'user')
    // log('android patch detail alt', body)
    test.done()
  })
}


exports.androidPatchesInteresting = function(test) {
  t.get('/stats/to/patches/from/messages?type=content',
  function(err, res, body) {
    t.assert(body.data && body.data.length === 20)
    test.done()
  })
}


exports.androidUserDetail = function(test) {
  t.post({
    uri: '/do/getEntitiesForEntity?' + user.cred,
    body: {
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
    t.assert(body && body.data && body.data.length === 50)
    t.assert(body.entity)
    t.assert(body.more)
    test.done()
  })
}


exports.iosGetUserFeed = function (test) {
  t.post({
    uri: '/user/getNotifications?limit=50&' + user.cred,
    body: {
      limit: 50,
      more: true,
      skip: 0,
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 50)
    test.done()
  })
}


exports.andoidGetUserFeed = function(test) {
  t.post({
    uri: '/user/getNotifications?limit=20&' + user.cred,
    body: {
      entityId: user._id,
      cursor: {
        sort: { modifiedDate: -1 },
        limit: 20,
        skip: 0,
      }
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.count === 20)
    test.done()
  })
}


exports.iosPatchesNearAgain = function(test) {
  exports.iosPatchesNear(test)
}

exports.iosPatchesNearAltAgain = function(test) {
  exports.iosPatchesNearAlt(test)
}

exports.iosPatchDetailAgain = function(test) {
  exports.iosPatchDetail(test)
}

exports.iosPatchDetailAltAgain = function(test) {
  exports.iosPatchDetailAlt(test)
}

