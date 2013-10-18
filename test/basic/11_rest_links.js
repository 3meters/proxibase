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
    t.assert(400.11 === body.error.code)
    test.done()
  })
}

exports.findLinksWorks = function(test) {
  query.body = {links: [{to: {documents: 1}}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(1 === body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(2 === links.to.documents.length)
    test.done()
  })
}

exports.findLinksBySchemaWithLinkFilterWorks = function(test) {
  query.body = {links: [{to: {document: 1}, linkFilter: {type: 'watch'}}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(1 === body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(1 === links.to.documents.length)
    t.assert(links.to.documents[0].data)
    test.done()
  })
}

exports.findLinksFieldFilterWorks = function(test) {
  query.body = {links: [{to: {document: 1}, fields: {name: 1}}]}
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(2 === links.to.documents.length)
    t.assert(links.to.documents[0].name)
    t.assert(links.to.documents[1].name)
    t.assert(!links.to.documents[0].data)
    t.assert(!links.to.documents[1].data)
    test.done()
  })
}

exports.findLinksSortsDescendingByDefault = function(test) {
  query.body = {links: [{to: {document: 1}}]}
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(toDocs[0]._id > toDocs[1]._id)
    test.done()
  })
}

exports.findLinksSortWorks = function(test) {
  query.body = {links: [{to: {document: 1}, sort: [{_id: 1}]}]}
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(toDocs[0]._id < toDocs[1]._id)
    test.done()
  })
}

exports.findLinksLimitsWork = function(test) {
  query.body = {links: [{to: {document: 1}, limit: 1}]}
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(1 === toDocs.length)
    t.assert('do.linkdoc2' === toDocs[0]._id)
    test.done()
  })
}

exports.findLinksSkipWorks = function(test) {
  query.body = {links: [{to: {document: 1}, limit: 1, skip: 1}]}
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(1 === toDocs.length)
    t.assert('do.linkdoc1' === toDocs[0]._id)
    test.done()
  })
}

_exports.findLinksIncludeLinkFieldsWorks = function(test) {
  query.body = {links: [{to: {document: 1}, linkFields: {type:1}}]}
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(toDocs[0].link)
    t.assert(toDocs[0].link.type)
    t.assert('watch' === toDocs[0].link.type)
    t.assert('like' === toDocs[0].link.type)
    t.assert(false)
    test.done()
  })
}

_exports.findLinksAcceptsSingletonQueries = function(test) {
  query.body = {links: {to: {document: 1}, fields: {name: 1}}}

}
