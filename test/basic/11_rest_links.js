/*
 *  Proxibase rest links basic test
 */

var util = require('proxutils')
var log = util.log
var type = util.type
var testUtil = require('../util')
var t = testUtil.treq
var userSession
var userCred
var userId
var query
var adminSession
var adminCred
var _exports = {}  // For commenting out tests


exports.getUserSession = function(test) {
  testUtil.getUserSession(function(session) {
    userSession = session
    userId = session._owner
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminSession = session
      adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
    })
  })
}


exports.addLinkedData = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: 'do.linkdoc1', name: 'LinkDoc1'}}
  }, 201, function(err, res, body) {
    t.post({
      uri: '/data/documents?' + userCred,
      body: {data: {_id: 'do.linkdoc2', name: 'LinkDoc2', data: {foo: 'bar'}}}
    }, 201, function(err, res, body) {
      t.post({
        uri: '/data/documents?' + userCred,
        body: {data: {_id: 'do.linkdoc3', name: 'LinkDoc3'}}
      }, 201, function(err, res, body) {
        t.post({
          uri: '/data/links?' + userCred,
          body: {data: {_to: 'do.linkdoc1', _from: userId, type: 'like'}}
        }, 201, function(err, res, body) {
          t.post({
            uri: '/data/links?' + userCred,
            body: {data: {_to: 'do.linkdoc2', _from: userId, type: 'watch'}}
          }, 201, function(err, res, body) {
            t.post({
              uri: '/data/links?' + userCred,
              body: {data: {_to: userId, _from: 'do.linkdoc3', type: 'viewedBy'}}
            }, 201, function(err, res, body) {
              test.done()
            })
          })
        })
      })
    })
  })
}

exports.findLinksFailProperlyOnBadInputs = function(test) {
  query = {uri: '/find/users/' + userId}
  query.body = {links: [{bogus: 'documents'}]}
  t.post(query, 400, function(err, res, body) {
    t.assert(400.1 === body.error.code) // missing required param
    query.body = {links: [{to: 'bogus'}]}
    t.post(query, 400, function(err, res, body) {
      t.assert(400.13 === body.error.code) // bad value
      test.done()
    })
  })
}

exports.findLinksWorks = function(test) {
  query.body = {links: [{to: 'documents'}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.to_documents)
    t.assert(2 === body.data.to_documents.length)
    t.assert('do.linkdoc2' === body.data.to_documents[0]._id)  // default sort by most recent
    t.assert(body.data.to_documents[0].data)  // includes all fields
    test.done()
  })
}

exports.findLinksByLinkTypeWorks = function(test) {
  query.body = {links: [{to: 'documents', linkType: 'watch'}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.to_documents_watch)
    t.assert(1 === body.data.to_documents_watch.length)
    t.assert('watch' === body.data.to_documents_watch[0].linkType)
    test.done()
  })
}

exports.findLinksFieldFilterWorks = function(test) {
  query.body = {links: [{to: 'documents', fields: ['name']}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.to_documents)
    t.assert(2 === body.data.to_documents.length)
    t.assert(body.data.to_documents[0].name)
    t.assert(body.data.to_documents[1].name)
    t.assert(!body.data.to_documents[0].data)
    t.assert(!body.data.to_documents[1].data)
    test.done()
  })
}

exports.findFromLinksWorks = function(test) {
  query.body = {links: [{from: 'documents'}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.from_documents)
    t.assert(1 === body.data.from_documents.length)
    t.assert('do.linkdoc3' === body.data.from_documents[0]._id)
    t.assert('viewedBy' === body.data.from_documents[0].linkType)
    test.done()
  })
}

exports.findLinksNameAliasingWithAsWorks = function(test) {
  query.body = {links: [{to: 'documents', as: 'myLinkedDocs'}]}
  t.post(query, function(err, res, body) {
    t.assert(!body.data.to_documents)
    t.assert(2 === body.data.myLinkedDocs.length)
    test.done()
  })
}

exports.findLinksLimitsWork = function(test) {
  query.body = {links: [{to: 'documents', limit: 1}]}
  t.post(query, function(err, res, body) {
    t.assert(1 === body.data.to_documents.length)
    test.done()
  })
}

exports.findLinksLimitTooBigFailsProperly = function(test) {
  query.body = {links: [{to: 'documents', limit: 5000}]}
  t.post(query, 400, function(err, res, body) {
    t.assert(400.13 === body.error.code)  // bad value
    test.done()
  })
}
