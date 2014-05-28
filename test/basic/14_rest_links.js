/*
 *  Proxibase rest links basic test
 */

var util = require('proxutils')
var log = util.log
var tipe = util.tipe
var testUtil = require('../util')
var constants = require('../constants')
var skip = testUtil.skip
var t = testUtil.treq
var userSession
var userCred
var userId
var adminSession
var adminCred
var _exports = {}  // For commenting out tests

// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var cPlaces = dbProfile.beacons * dbProfile.epb

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
    uri: '/find/users/' + user1Id + '?' + adminCred,
    body: {links: {to: {fakeCollection: 1}}},
  }
  t.post(query, 400, function(err, res, body) {
    t.assert(400.13 === body.error.code)
    test.done()
  })
}

exports.findLinksWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + adminCred,
    body: {links: {to: {places: 1}}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.places)
    var cLike = cWatch = cCreate = 0
    links.to.places.forEach(function(link) {
      t.assert(link._id)
      t.assert(link.document)
      t.assert(link.document._id)
      t.assert(link.document.schema === 'place')
      switch (link.type) {
        case 'like': cLike++; break
        case 'watch': cWatch++; break
        case 'create': cCreate++; break
      }
    })
    t.assert(cLike === cPlaces, cLike)
    t.assert(cWatch === cPlaces, cWatch)
    t.assert(cCreate === 1)
    test.done()
  })
}

exports.findLinksNoDocumentsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, noDocuments: true}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.places)
    t.assert(links.to.places.length === ((cPlaces * 2) + 1))  // same as above
    links.to.places.forEach(function(link) {
      t.assert(!link.document)
    })
    test.done()
  })
}

exports.findLinksFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, fields: {name: 1}, linkFields: {type: 1}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.places)
    t.assert(links.to.places.length)
    links.to.places.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.type)
      t.assert(!doc.modifiedDate)
      t.assert(doc.document)
      t.assert(doc.document._id)
      t.assert(doc.document.name)
      t.assert(!doc.document._owner)
    })
    test.done()
  })
}

exports.findLinksLinkFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, linkFilter: {type: 'watch'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.places)
    t.assert(cPlaces === links.to.places.length)
    test.done()
  })
}

_exports.findLinksLinkDocFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, filter: {namelc: 'museum of modern art 3'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.places)
    t.assert(2 === links.to.places.length)
    test.done()
  })
}


exports.findLinksSortsDescendingByLinkIdByDefault = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}}}
  }
  t.post(query, function(err, res, body) {
    var placeLinks = body.data.links.to.places
    var lastId = 'zzzzzzzz'
    placeLinks.forEach(function(link) {
      t.assert(link._id < lastId, {current: link._id, previous: lastId})
      lastId = link._id
    })
    test.done()
  })
}

exports.findLinksSortWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, linkFilter: {type: 'like'}, sort: [{_id: 1}]}}
  }
  t.post(query, function(err, res, body) {
    var placeLinks = body.data.links.to.places
    var lastLinkId = lastDocId = ''
    placeLinks.forEach(function(link) {
      t.assert(link._id > lastLinkId, {current: link, previous: lastLinkId})
      t.assert(link.document._id > lastDocId, {current: link, previous: lastLinkId})
      lastLinkId = link._id
      lastDocId = link.document._id
    })
    // Watches were created in the oposite order of likes. See /tools/pump/genData.
    // This test proves we are sorting on the link, not a property of the underlying document
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {places: 1}, linkFilter: {type: 'watch'}, sort: [{_id: 1}]}}  // watch not like
    }
    t.post(query, function(err, res, body) {
      var placeLinks = body.data.links.to.places
      var lastLinkId = ''
      var lastDocId = 'zzzzzzzz'
      placeLinks.forEach(function(link) {
        t.assert(link._id > lastLinkId, {current: link, previous: lastLinkId})
        t.assert(link.document._id < lastDocId, {current: link, previous: lastLinkId}) // < not >
        lastLinkId = link._id
        lastDocId = link.document._id
      })
      test.done()
    })
  })
}

_exports.findLinksPagingWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var placeLinks = body.data.links.to.places
    t.assert(5 === placeLinks.length)
    var lastLinkId = placeLinks[4]._id
    var lastPlaceId = placeLinks[4].document._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {places: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var placeLinks = body.data.links.to.places
      t.assert(5 === placeLinks.length)
      t.assert(lastLinkId > placeLinks[0]._id)
      test.done()
    })
  })
}

_exports.findLinksPagingWorksWithFilter = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {places: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var placeLinks = body.data.links.to.places
    t.assert(5 === placeLinks.length)
    var lastLinkId = placeLinks[4]._id
    var lastPlaceId = placeLinks[4].document._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {places: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var placeLinks = body.data.links.to.places
      t.assert(5 === placeLinks.length)
      t.assert(lastLinkId > placeLinks[0]._id)
      test.done()
    })
  })
}


exports.findLinksCountWorks = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: {to: {documents: 1}, from: {documents: 1}, count: true}}
  }
  t.post(query, function(err, res, body) {
    t.assert(1 === body.data.links.from.documents)
    t.assert(2 === body.data.links.to.documents)
    test.done()
  })
}

exports.findLinksAcceptsArrays = function(test) {
  var query = {
    uri: '/find/users/' + userId + '?' + userCred,
    body: {links: [{to: {documents: 1}}, {from: {documents: 1}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.length === 2)  // nested in an array
    t.assert(body.data.links[0].to)
    t.assert(body.data.links[0].to.documents)
    var toDocs = body.data.links[0].to.documents
    t.assert(2 === toDocs.length)
    t.assert(toDocs[0]._id > toDocs[1]._id)
    t.assert(toDocs[0].document)
    t.assert(toDocs[1].document)
    t.assert(toDocs[0]._id > toDocs[1]._id)
    t.assert('LinkDoc2' === toDocs[0].document.name)
    t.assert('LinkDoc1' === toDocs[1].document.name)
    t.assert(body.data.links[1].from.documents)
    t.assert(body.data.links[1].from.documents.length)
    test.done()
  })
}


_exports.findLinksFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/documents?links[from][users]=1&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.length === 2)
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

_exports.findAllLinksWorks = function(test) {
  var query = {
    uri: '/find/documents?links[to]=1&links[from]=1&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.length >= 3)
    var cLinks = 0
    body.data.forEach(function(doc) {
      t.assert(doc.links)
      t.assert(doc.links.to)
      t.assert(doc.links.from)
      if (doc._id === 'do.linkdoc1') {
        cLinks++
        t.assert(doc.links.from.users)
        t.assert(doc.links.from.users.length === 1)
        t.assert(doc.links.from.users[0].type === 'like')
        t.assert(doc.links.from.users[0].document)
      }
      if (doc._id === 'do.linkdoc2') {
        cLinks++
        t.assert(doc.links.from.users)
        t.assert(doc.links.from.users.length === 1)
        t.assert(doc.links.from.users[0].type === 'watch')
        t.assert(doc.links.from.users[0].document)
      }
      if (doc._id === 'do.linkdoc3') {
        cLinks++
        t.assert(doc.links.to.users)
        t.assert(doc.links.to.users.length === 1)
        t.assert(doc.links.to.users[0].type === 'content')
        t.assert(doc.links.to.users[0].document)
      }
    })
    t.assert(3 === cLinks)
    test.done()
  })
}
