/**
 *  Proxibase admin tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var qs = require('querystring')
var db = testUtil.db
var t = testUtil.treq
var userSession
var userCred
var adminSession
var adminCred
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session, user, credentials) {
    userCred = qs.stringify(credentials)
    testUtil.getAdminSession(function(session, user, credentials) {
      adminCred = qs.stringify(credentials)
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

  var orphanMessage1 = {
    _id: 'me.gctest.orphanMessage1',
  }

  var links = [goodLink, badLink1, badLink2, badLink3, badLink4]

  db.collection('users').insert([user1, user2], function(err) {
    assert(!err, err)
    db.collection('links').insert(links, function(err, result) {
      assert(!err, err)
      assert(result)
      if (result.ops) t.assert(result.ops.length === 5, util.inspect(result)) // Version 2.x mongodb driver
      else t.assert(result.length === 5)  // Version 1.x mongodb driver
      db.collection('messages').insert(orphanMessage1, function(err, result) {
        assert(!err, err)
        test.done()
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
    t.assert(body.movedToTrash === 4, util.inspect(body))
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
    t.assert(body.orphans.messages.length = 1)
    t.assert(body.count === 1)
    t.assert(body.movedToTrash === 0)
    test.done()
  })
}

exports.moveBadEntsToTrash = function(test) {
  t.get('/admin/gcentities/remove?' + adminCred, function(err, res, body) {
    t.assert(body.orphans)
    t.assert(body.count === 1)
    t.assert(body.movedToTrash === 1)
    db.collection('messages').find({_id: /^me\.gctest/}).toArray(function(err, links) {
      t.assert(!err, err)
      t.assert(links.length === 0)
      db.collection('trash').find({fromSchema: 'message'}).toArray(function(err, docs) {
        t.assert(!err, err)
        t.assert(docs)
        t.assert(docs.length === 1, docs)
        t.assert(docs[0].data._id === 'me.gctest.orphanMessage1')
        test.done()
      })
    })
  })
}


exports.cleanup = function(test) {
  db.collection('links').remove({_id: /^li.gctest/}, function(err, r) {
    assert(!err, err)
    if (tipe.isObject(r)) assert(r.result.n === 1, r.result)
    else assert(r === 1)  // mongodb 1.x driver
    test.done()
  })
}
