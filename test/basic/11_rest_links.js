/*
 *  Proxibase rest links basic test
 */

var util = require('proxutils')
var log = util.log
var type = util.type
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var userSession
var userCred
var userId
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
              body: {data: {_to: userId, _from: 'do.linkdoc3', type: 'content'}}
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
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{bogus: 'documents'}]},
  }
  t.post(query, 400, function(err, res, body) {
    t.assert(400.11 === body.error.code)
    test.done()
  })
}

exports.findLinksWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}}]},
  }
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

exports.findLinksFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}, fields: {type: 1}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(1 === body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(2 === links.to.documents.length)
    links.to.documents.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.type)
      t.assert(!doc.modifiedDate)
    })
    test.done()
  })
}

exports.findLinksFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}, filter: {type: 'watch'}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(1 === body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(1 === links.to.documents.length)
    test.done()
  })
}

exports.findLinksWithDocFieldsWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: {name: 1}}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.length)
    var links = body.data.links[0]
    t.assert(links.to)
    t.assert(links.to.documents)
    t.assert(2 === links.to.documents.length)
    t.assert(links.to.documents[0].document)
    t.assert(links.to.documents[1].document)
    t.assert(links.to.documents[0].document.name)
    t.assert(links.to.documents[1].document.name)
    t.assert(!links.to.documents[0].document.data)
    t.assert(!links.to.documents[1].document.data)
    test.done()
  })
}

exports.findLinksSortsDescendingByDefault = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}}]}
  }
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(toDocs[0]._id > toDocs[1]._id)
    test.done()
  })
}

exports.findLinksSortWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}, sort: [{_id: 1}]}]}
  }
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(toDocs[0]._id < toDocs[1]._id)
    test.done()
  })
}

exports.findLinksLimitsWork = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}, limit: 1}]}
  }
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(1 === toDocs.length)
    t.assert('do.linkdoc2' === toDocs[0]._to)
    test.done()
  })
}

exports.findLinksSkipWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}, limit: 1, skip: 1}]}
  }
  t.post(query, function(err, res, body) {
    var toDocs = body.data.links[0].to.documents
    t.assert(1 === toDocs.length)
    t.assert('do.linkdoc1' === toDocs[0]._to)
    test.done()
  })
}

exports.findLinksAcceptsSingletonQueries = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: {to: {documents: {}}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.to)              // not nested in an array
    t.assert(body.data.links.to.documents)
    var toDocs = body.data.links.to.documents
    t.assert(2 === toDocs.length)
    t.assert(toDocs[0]._id > toDocs[1]._id)
    t.assert(toDocs[0].document)
    t.assert(toDocs[1].document)
    t.assert(toDocs[0]._id > toDocs[1]._id)
    t.assert('LinkDoc2' === toDocs[0].document.name)
    t.assert('LinkDoc1' === toDocs[1].document.name)
    test.done()
  })
}


exports.findLinksFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/documents?links[from][users][]&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.length >= 3)
    body.data.forEach(function(doc) {
      t.assert(doc.links)
      t.assert(doc.links.from)              // not nested in an array
      t.assert(doc.links.from.users)
      var fromUsers = doc.links.from.users
      switch (doc._id) {
        case 'do.linkdoc1':
          t.assert(1 === fromUsers.length)
          t.assert('like' === fromUsers[0].type)
          t.assert(fromUsers[0].document)
          break
        case 'do.linkdoc2':
          t.assert(1 === fromUsers.length)
          t.assert('watch' === fromUsers[0].type)
          t.assert(fromUsers[0].document)
          break
        default:
          t.assert(0 === fromUsers.length)
          break
      }
    })
    test.done()
  })
}

exports.specifyLinkDocfieldsAtLinkQueryOverrideSpecAtCollection = function(test) {
  return skip(test)
  // NYI
}
