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


exports.canAddLinkedData = function(test) {
  t.post({
    uri: '/data/documents?' + userCred,
    body: {data: {_id: 'do.linkdoc1', name: 'LinkDoc1'}}
  }, 201, function(err, res, body) {
    t.post({
      uri: '/data/documents?' + userCred,
      body: {data: {_id: 'do.linkdoc2', name: 'LinkDoc2'}}
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
              body: {data: {_to: userId, _from: 'do.linkDoc3', type: 'viewedBy'}}
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
    test.done()
  })
}
