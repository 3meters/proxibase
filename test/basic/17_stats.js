/**
 *  Proxibase link stats basic test
 *     linkStats is a computed collection
 *
 *
 *     TODO:  make this test run with a randomly generated seed
 *     for ids so that it can be run concurrently to test the stat
 *     engine under load
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.db   // raw mongodb connection object without mongoSafe wrapper
var adminUserId
var userSession
var userCred
var adminSession
var adminCred
var oldLinkCount

var testStartTime = util.now()
var _exports = {}  // For commenting out tests


// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var patch1Id = 'pa.statsTestPatch1'
var cUsers = dbProfile.users
var cPatches = dbProfile.users * dbProfile.ppu
var cMessages = cPatches * dbProfile.mpp


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


exports.cannotCreateStatsAsUser = function(test) {
  t.get({
    uri: '/stats/to/refresh?' + userCred
  }, 403, function(err, res, body){
    test.done()
  })
}

exports.cannotCreateStatsAsUser = function(test) {
  t.get({
    uri: '/stats/rebuild?' + userCred
  }, 403, function(err, res, body){
    test.done()
  })
}

exports.welcome = function(test) {
  t.get({
    uri: '/stats',
  }, function(err, res, body){
    t.assert(body.info)
    test.done()
  })
}

exports.adminCanRefreshTos = function(test) {
  t.get({
    uri: '/stats/to/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body)
    t.assert(body.cmd)
    t.assert(body.results)
    test.done()
  })
}

exports.adminCanRefreshFroms = function(test) {
  t.get({
    uri: '/stats/from/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body.cmd)
    t.assert(body.results)
    test.done()
  })
}

exports.adminCanRefreshAll = function(test) {
  t.get({
    uri: '/stats/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body)
    t.assert(body.to)
    t.assert(body.to.cmd)
    t.assert(body.to.results)
    t.assert(body.from)
    t.assert(body.from.cmd)
    t.assert(body.from.results)
    test.done()
  })
}


// Relies on default sample data
exports.statsCountContentMessagesToPatchesViaPost = function(test) {
  t.post({
    uri: '/stats/to/patches/from/messages',
    body: {
      type: 'content'
    },
  }, function(err, res, body) {
    var count = (body.data && body.data.length)
    t.assert(count)
    t.assert(count === cPatches)
    var cMsg = 0
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.schema)
      t.assert(doc.count)
      t.assert(doc.rank)
      cMsg += doc.count
    })
    t.assert(cMsg === cMessages) // predicted at top of file
    test.done()
  })
}


exports.statsCountPatchesByTunings = function(test) {
  t.get('/stats/from/patches?type=proximity',
  function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}


exports.addSomeTestData = function(test) {

  var newPatches = [{
    _id: patch1Id,
    name: 'statsTestPatch1',
    schema: 'patch',
  }]

  var newMsgs = [{
    _id: 'me.statTest.1',
    name: 'StatTest Message1',
    _owner: user1Id,
  }, {
    _id: 'me.statTest.2',
    name: 'StatTest Message2',
    _owner: user1Id,
  }, {
    _id: 'me.statTest.3',
    name: 'StatTest Message3',
    _owner: user1Id,
  }, ]

  var newBeacons = [{
    _id: 'be.statTestBeacon1',
    name: 'StatTest Beacon1',
    _owner: util.adminId,
    schema: 'beacon',
    bssid: 'statTestBeacon1',
  }]

  var newLinks = [{
    _id: 'li.140101.statTest.1',
    _to: patch1Id,
    _from: 'me.statTest.1',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.2',
    _to: patch1Id,
    _from: 'me.statTest.2',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.3',
    _to: patch1Id,
    _from: 'me.statTest.3',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.4',
    _to: 'be.statTest1',
    _from: patch1Id,
    toSchema: 'beacon',
    fromSchema: 'patch',
    type: 'proximity',
  }]

  // TODO:  this is a probably a bad idea.  figure out how to use the safe methods
  db.collection('patches').insert(newPatches, function(err, savedPatches) {
    assert(!err, err)
    db.collection('messages').insert(newMsgs, function(err, savedMsgs) {
      assert(!err, err)
      db.collection('beacons').insert(newBeacons, function(err, savedBeacons) {
        assert(!err, err)
        db.collection('links').insert(newLinks, function(err, savedLinks) {
          assert(!err, err)
          test.done()
        })
      })
    })
  })
}

exports.refreshWorks = function(test) {
  t.get('/stats/refresh?' + adminCred,
  function(err, res, body){
    t.assert(body)
    t.assert(body.to)
    t.assert(body.to.cmd)
    t.assert(body.to.results)
    t.assert(body.from)
    t.assert(body.from.cmd)
    t.assert(body.from.results)
    t.get('/find/tos?query[_id.fromSchema]=message&sort=-value&limit=1000',
    function(err, res, body) {
      t.assert(body.data.length)
      // refresh picked up our new links and created a summary record for them.
      t.assert(body.data.some(function(stat) {
        return stat._id.day === '140101'
            && stat._id._to === patch1Id
            && stat.value === 3
      }))
      t.get('/find/froms?query[_id.fromSchema]=patch&query[_id.toSchema]=beacon&limit=1000',
      function(err, res, body) {
        t.assert(body.data.length)
        // refresh picked up our new links and created a summary record for them.
        t.assert(body.data.some(function(stat) {
          return stat._id.day === '140101'
              && stat._id._from === patch1Id
              && stat.value === 1
        }))
        test.done()
      })
    })
  })
}

exports.addSomeMoreTestData = function(test) {

  var newMsgs = [{
    _id: 'me.statTest.4',
    name: 'StatTest Message4',
    _owner: user1Id,
  }, {
    _id: 'me.statTest.5',
    name: 'StatTest Message5',
    _owner: user1Id,
  }, {
    _id: 'me.statTest.6',
    name: 'StatTest Message6',
    _owner: user1Id,
  }]

  var newLinks = [{
    _id: 'li.140101.statTest.5',
    _to: patch1Id,
    _from: 'me.statTest.5',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.6',
    _to: patch1Id,
    _from: 'me.statTest.6',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.7',
    _to: patch1Id,
    _from: 'me.statTest.7',
    fromSchema: 'message',
    toSchema: 'patch',
    type: 'content',
  }, {
    _id: 'li.140101.statTest.8',
    _to: patch1Id,
    _from: user1Id,
    fromSchema: 'user',
    toSchema: 'patch',
    type: 'watch',
  }, {
    _id: 'li.140101.statTest.9',
    _to: patch1Id,
    _from: user2Id,
    fromSchema: 'user',
    toSchema: 'patch',
    type: 'watch',
  }]

  db.collection('messages').insert(newMsgs, function(err, savedMsgs) {
    assert(!err, err)
    db.collection('links').insert(newLinks, function(err, savedLinks) {
      assert(!err, err)
      test.done()
    })
  })
}

exports.refreshTosWorksWithIncrementalReduce = function(test) {
  t.get({
    uri: '/stats/to/refresh?' + adminCred
  }, function(err, res, body){
    t.assert(body)
    t.assert(body.cmd)
    t.assert(body.results)
    t.get({
      uri: '/find/tos?query[_id.fromSchema]=message&sort=-value,-_id.day'
    }, function(err, res, body) {
      t.assert(body.data.length)

      // refresh picked up our new links and created a summary record for them.
      t.assert(body.data.some(function(stat) {
        return stat._id.day === '140101'
            && stat._id._to === patch1Id
            && stat._id.type === 'content'
            && stat.value === 6  // proves messages 4, 5, and 6 were reduced into the same record as 1, 2, and 3
      }))

      if (dbProfile.mpp <= 6) t.assert(body.data[0]._id.day === '140101') // we should sort to the top
      else t.assert(body.data[cPatches]._id.day = '140101') // we should sort to the bottom
      test.done()
    })
  })
}

exports.refreshWorksWithDeleteWatchLink = function(test) {
  t.get('/find/tos?query[_id._to]=' + patch1Id + '&query[_id.type]=watch',
  function(err, res, body) {
    t.assert(body.data.length === 1)
    var stat = body.data[0]
    t.assert(stat.value === 2)
    t.del({
      uri: '/data/links/li.140101.statTest.8?' + adminCred ,
    }, function(err, res, body) {
      t.assert(body.count === 1)
      t.get('/stats/to/refresh?' + adminCred,
      function(err, res, body) {
        t.get('/find/tos?query[_id._to]=' + patch1Id + '&query[_id.type]=watch',
        function(err, res, body) {
          t.assert(body.data.length === 1)
          var stat = body.data[0]
          t.assert(stat.value === 1)
          test.done()
        })
      })
    })
  })
}

exports.createThenDeleteOfWatchLinkBetweenRefreshesWorks = function(test) {

  var watchLink = {
    _id: 'li.140101.statTest.10',
    _to: patch1Id,
    _from: user3Id,
    fromSchema: 'user',
    toSchema: 'patch',
    type: 'watch',
  }

  t.post({
    uri: '/data/links?' + adminCred,
    body: {data: watchLink},
  }, 201, function(err, res, body) {
    t.get('/find/tos?query[_id._to]=' + patch1Id + '&query[_id.type]=watch',
    function(err, res, body) {
      t.assert(body.data.length === 1)
      var stat = body.data[0]
      t.assert(stat.value === 1) // same as last test, not refreshed
      t.del({
        uri: '/data/links/' + watchLink._id + '?' + adminCred,
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.get('/stats/to/refresh?' + adminCred,
        function(err, res, body) {
          t.get('/find/tos?query[_id._to]=' + patch1Id + '&query[_id.type]=watch',
          function(err, res, body) {
            t.assert(body.data.length === 1)
            var stat = body.data[0]
            log('NYI:  need custom linkId factory in order to test')
            // t.assert(stat.value === 1) // same as last test, not refreshed, not decremented
            test.done()
          })
        })
      })
    })
  })
}

// These test the underlying computed collections
exports.statFilterWorks = function(test) {
  t.get({
    uri: '/find/tos?query[_id._to]=' + testUserId
  }, function(err, res, body) {
    t.assert(body.data)
    oldLinkCount = 0
    body.data.forEach(function(stat) {
      oldLinkCount += stat.value
    })
    test.done()
  })
}


// Manually add a new link from the test user to the same user liking
// himself, then update the statistics and ensure that his new link
// appears in the persisted stats collection
exports.staticsUpdateOnRefresh = function(test) {
  t.post({
    uri: '/data/links?' + userCred,
    body: {
      data: {
        _from: testUserId,
        _to: testUserId,
        type: 'like'
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.get('/stats/to/refresh?' + adminCred, function(err, res, body) {
      t.assert(body.cmd)
      t.assert(body.results)
      t.get({
        uri: '/find/tos?query[_id._to]=' + testUserId + '&' + userCred
      }, function(err, res2, body) {
        t.assert(body.data.length)
        var newLinkCount = 0
        body.data.forEach(function(stat) {
          newLinkCount += stat.value
        })
        t.assert(newLinkCount === oldLinkCount + 1)
        t.assert(body.data.some(function(stat) {
          return testUserId === stat._id._to
            && 'user' === stat._id.toSchema
            && 'like' === stat._id.type
        }))
        test.done()
      })
    })
  })
}

// Manually add a new link from the test user to the same user liking
// himself, then update the statistics and ensure that his new link
// appears in the persisted stats collection
exports.staticsUpdateOnIncrementalRefresh = function(test) {
  t.post({
    uri: '/data/links?' + adminCred,
    body: {
      data: {
        _from: adminUserId,
        _to: testUserId,
        type: 'like'
      }
    }
  }, 201, function(err, res, body) {
    t.assert(body.count === 1)
    t.get('/stats/to/refresh?' + adminCred, function(err, res, body) {
      t.assert(body.cmd)
      t.assert(body.results)
      t.get({
        uri: '/find/tos?query[_id._to]=' + testUserId + '&' + userCred
      }, function(err, res2, body) {
        t.assert(body.data.length)
        var newLinkCount = 0
        body.data.forEach(function(stat) {
          newLinkCount += stat.value
        })
        t.assert(newLinkCount === oldLinkCount + 2)
        test.done()
      })
    })
  })
}

exports.statsPassThroughQueryCriteriaToUnderlyingReducedCollections = function(test) {
  t.get({
    uri: '/stats/to?query[_id._to]=' + testUserId + '&query[_id.type]=like'
  }, function(err, res, body) {
    t.assert(body.data.length === 1)
    t.assert(body.data[0].count === 2)
    test.done()
  })
}


exports.statRefsDoNotPopulateForAnonUsers = function(test) {
  t.get({
    uri: '/find/tos?query[_id._to]=' + testUserId + '&refs=true'
  }, function(err, res, body) {
    t.assert(body.data[0]._id._to)
    t.assert(!body.data[0]._id.to)
    test.done()
  })
}


exports.statsCountToPatchesTypeWatch = function(test) {
  t.get({
    uri: '/stats/to/patches?type=watch&log=1',
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    t.assert(body.query['tos.aggregate'])  // output of the log param is the mongdb agregation query
    test.done()
  })
}

exports.statsFilterOnCategory = function(test) {
  t.get({
    uri: '/stats/to/patches?_category=testCategory&log=1'
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc.category)
      t.assert(doc.category.id === 'testCategory')
    })
    test.done()
  })
}

exports.statsFilterOnName = function(test) {
  t.get({
    uri: '/stats/to/patches?name=Test P'
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    test.done()
  })
}

exports.statsCountCreatedLinksFromUsers = function(test) {
  t.get({
    uri: '/stats/from/users?type=create',
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.photo)
      t.assert(doc.count)
      t.assert(doc.rank)
    })
    test.done()
  })
}

exports.statsRemoveMessageDecrementsPatchStats = function(test) {
  t.get('/stats/to/patches/' + patch1Id,
  function(err, res, body) {
    t.assert(body && body.data && !body.data.length)  // document, not array
    var cToPatch = body.data.count
    t.get('/stats/from/patches/' + patch1Id,
    function(err, res, body) {
      t.assert(body && body.data)
      t.del({uri: '/data/messages/me.statTest.1?' + adminCred},
      function(err, res, body) {
        t.assert(body.count === 1)
        t.get('/stats/to/patches/' + patch1Id,
        function(err, res, body) {
          t.assert(body.data)
          t.assert(cToPatch === body.data.count + 1)  // proves stat decrement worked
          test.done()
        })
      })
    })
  })
}

exports.statsRemovePatchDropsFromStats= function(test) {
  return skip(test)
  t.get('/stats/to/patches',
  function(err, res, body) {
    t.assert(body && body.data && body.data.length)
    var cToPatches = body.data.length
    t.get('/stats/from/patches',
    function(err, res, body) {
      t.assert(body && body.data && body.data.length)
      var cFromPatches = body.data.length
      t.del({uri: '/data/patches/' + patch1Id + '?' + adminCred},
      function(err, res, body) {
        t.assert(body.count === 1)
        t.get('/stats/to/patches',
        function(err, res, body) {
          t.assert(body.data && body.data.length)
          t.assert(body.data.length + 1 === cToPatches)
          t.get('/stats/from/patches',
          function(err, res, body) {
            t.assert(body.data && body.data.length)
            t.assert(body.data.length === (cFromPatches - 1))
            test.done()
          })
        })
      })
    })
  })
}

exports.adminCanRebuildTos = function(test) {
  t.get({
    uri: '/stats/to/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body)
    t.assert(body.cmd)
    t.assert(body.results)
    test.done()
  })
}

exports.adminCanRebuildFroms = function(test) {
  t.get({
    uri: '/stats/from/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body)
    t.assert(body.cmd)
    t.assert(body.results)
    test.done()
  })
}

exports.adminCanRebuildAll = function(test) {
  t.get({
    uri: '/stats/rebuild?' + adminCred
  }, function(err, res, body) {
    t.assert(body)
    t.assert(body.to)
    t.assert(body.to.cmd)
    t.assert(body.to.results)
    t.assert(body.from)
    t.assert(body.from.cmd)
    t.assert(body.from.results)
    test.done()
  })
}
