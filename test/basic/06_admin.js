/**
 *  Proxibase admin tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var db = testUtil.db   // raw mongodb connection object without mongoSafe wrapper
var t = testUtil.treq
var userSession
var userCred
var adminSession
var adminCred
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}


exports.onlyAdminsCanUse = function(test) {
  t.get('/admin/validate?' + userCred, 401, function(err, res, body) {
   test.done()
  })
}


exports.validateTestData = function(test) {
  t.get('/admin/validate?' + adminCred, function(err, res, body) {
    t.assert(body.results)
    t.assert(body.schemaErrors)
    t.assert(body.schemaErrors.length === 0)
    test.done()
  })
}


exports.addSomeTestData = function(test) {

  var user1 = {_id: 'us.adminTestUser1', email: 'adminTestUser1@3meters.com'}
  var user2 = {_id: 'us.adminTestUser2', email: 'adminTestUser2@3meters.com'}

  var goodLink = {
    _id: 'li.gctest.goodlink',
    _from: user1._id,
    _to: user2._id,
    type: '0',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var badLink1 = {
    _id: 'li.gctest.badLink1',
    _from: user1._id,
    _to: user2._id,
    type: '1',
    fromSchema: 'BOGUS1',
    toSchema: 'user',
  }

  var badLink2 = {
    _id: 'li.gctest.badLink2',
    _from: user1._id,
    _to: user2._id,
    type: '2',
    fromSchema: 'user',
    toSchema: 'BOGUS2',
  }

  var badLink3 = {
    _id: 'li.gctest.badLink3',
    _from: 'BOGUS3',
    _to: user2._id,
    type: '3',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var badLink4 = {
    _id: 'li.gctest.badLink4',
    _from: user1._id,
    _to: 'BOGUS4',
    type: '4',
    fromSchema: 'user',
    toSchema: 'user',
  }

  var orphanPost1 = {
    _id: 'po.gctest.orphanPost1',
  }

  var orphanComment1 = {
    _id: 'co.gctest.orphanComment1',
  }

  var orphanApplink1 = {
    _id: 'ap.gctest.orphanApplink1',
  }

  var links = [goodLink, badLink1, badLink2, badLink3, badLink4]

  db.collection('users').insert([user1, user2], function(err) {
    assert(!err, err)
    db.collection('links').insert(links, function(err, result) {
      assert(!err, err)
      assert(result && result.length === 5, result)
      db.collection('comments').insert(orphanComment1, function(err, result) {
        assert(!err, err)
        db.collection('posts').insert(orphanPost1, function(err, result) {
          assert(!err, err)
          db.collection('applinks').insert(orphanApplink1, function(err, result) {
            assert(!err, err)
            test.done()
          })
        })
      })
    })
  })
}

exports.findBadLinks = function(test) {
  t.get('/admin/gclinks?' + adminCred, function(err, res, body) {
    t.assert(body.badLinks)
    t.assert(body.badLinks.length === 4)
    t.assert(body.count === 4)
    t.assert(body.movedToTrash === 0)
    test.done()
  })
}

exports.moveBadLinksToTrash = function(test) {
  t.get('/admin/gclinks/remove?' + adminCred, function(err, res, body) {
    t.assert(body.badLinks)
    t.assert(body.badLinks.length === 4)
    t.assert(body.count === 4)
    t.assert(body.movedToTrash === 4)
    db.collection('links').find({_id: /^li\.gctest/}).toArray(function(err, links) {
      assert(!err, err)
      assert(links.length === 1, {links: links})
      assert(links[0]._id === 'li.gctest.goodlink')  // good link survived the reaping
      db.collection('trash').find({fromSchema: 'link'}).toArray(function(err, docs) {
        t.assert(!err, err)
        t.assert(docs)
        t.assert(docs.length === 4)
        docs.forEach(function(doc) {
          t.assert(doc.data._id.match(/^li\.gctest\.badLink/))  // starts with li.gctest.bad
        })
        test.done()
      })
    })
  })
}

exports.findOrphanedEnts = function(test) {
  t.get('/admin/gcentities?' + adminCred, function(err, res, body) {
    t.assert(body.orphans)
    t.assert(body.orphans.comments.length = 1)
    t.assert(body.orphans.posts.length = 1)
    t.assert(body.orphans.applinks.length = 1)
    t.assert(body.count === 3)
    t.assert(body.movedToTrash === 0)
    test.done()
  })
}

exports.moveBadEntsToTrash = function(test) {
  t.get('/admin/gcentities/remove?' + adminCred, function(err, res, body) {
    t.assert(body.orphans)
    t.assert(body.count === 3)
    t.assert(body.movedToTrash === 3)
    db.collection('posts').find({_id: /^po\.gctest/}).toArray(function(err, links) {
      t.assert(!err, err)
      t.assert(links.length === 0)
      db.collection('trash').find({fromSchema: 'post'}).toArray(function(err, docs) {
        t.assert(!err, err)
        t.assert(docs)
        t.assert(docs.length === 1, docs)
        t.assert(docs[0].data._id === 'po.gctest.orphanPost1')
        test.done()
      })
    })
  })
}


exports.cleanup = function(test) {
  db.collection('links').remove({_id: /^li.gctest/}, function(err, count) {
    assert(!err, err)
    assert(count == 1, count)
    test.done()
  })
}