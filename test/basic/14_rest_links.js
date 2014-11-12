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


// From sample data in base test database
var dbProfile = testUtil.dbProfile
var user1Id = 'us.010101.00000.555.000001'
var user2Id = 'us.010101.00000.555.000002'
var user3Id = 'us.010101.00000.555.000003'
var cPatches = dbProfile.beacons * dbProfile.epb
var cUsers = dbProfile.users


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
    body: {links: {to: {patches: 1}}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    var cLike = cWatch = cCreate = 0
    links.to.patches.forEach(function(link) {
      t.assert(link._id)
      t.assert(link.document)
      t.assert(link.document._id)
      t.assert(link.document.schema === 'patch')
      switch (link.type) {
        case 'like': cLike++; break
        case 'watch': cWatch++; break
        case 'create': cCreate++; break
      }
    })
    t.assert(cLike === cPatches, cLike)
    t.assert(cWatch === cPatches, cWatch)
    t.assert(cCreate === 1)
    test.done()
  })
}

exports.findLinksNoDocumentsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, noDocuments: true}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(links.to.patches.length === ((cPatches * 2) + 1))  // same as above
    links.to.patches.forEach(function(link) {
      t.assert(!link.document)
    })
    test.done()
  })
}

exports.findLinksFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, fields: {name: 1}, linkFields: {type: 1}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(links.to.patches.length)
    links.to.patches.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.type)
      t.assert(!doc.modifiedDate)
      t.assert(doc.document)
      t.assert(doc.document._id)
      t.assert(doc.document.name)
      t.assert(doc.document._owner)
      t.assert(!doc.document._creator)
    })
    test.done()
  })
}

exports.findLinksLinkFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, linkFilter: {type: 'watch'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(cPatches === links.to.patches.length)
    test.done()
  })
}

exports.findLinksLinkDocFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, filter: {namelc: 'museum of modern art 3'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(2 === links.to.patches.length)
    test.done()
  })
}


exports.findLinksSortsDescendingByLinkIdByDefault = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    var lastId = 'zzzzzzzz'
    patchLinks.forEach(function(link) {
      t.assert(link._id < lastId, {current: link._id, previous: lastId})
      lastId = link._id
    })
    test.done()
  })
}

exports.findLinksSortWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, linkFilter: {type: 'like'}, sort: [{_id: 1}]}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    var lastLinkId = lastDocId = ''
    patchLinks.forEach(function(link) {
      t.assert(link._id > lastLinkId, {current: link, previous: lastLinkId})
      t.assert(link.document._id > lastDocId, {current: link, previous: lastLinkId})
      lastLinkId = link._id
      lastDocId = link.document._id
    })
    // Watches were created in the oposite order of likes. See /tools/pump/genData.
    // This test proves we are sorting on the link, not a property of the underlying document
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {patches: 1}, linkFilter: {type: 'watch'}, sort: [{_id: 1}]}}  // watch not like
    }
    t.post(query, function(err, res, body) {
      var patchLinks = body.data.links.to.patches
      var lastLinkId = ''
      var lastDocId = 'zzzzzzzz'
      patchLinks.forEach(function(link) {
        t.assert(link._id > lastLinkId, {current: link, previous: lastLinkId})
        t.assert(link.document._id < lastDocId, {current: link, previous: lastLinkId}) // < not >
        lastLinkId = link._id
        lastDocId = link.document._id
      })
      test.done()
    })
  })
}

exports.findLinksPagingWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    t.assert(5 === patchLinks.length)
    var lastLinkId = patchLinks[4]._id
    var lastPatchId = patchLinks[4].document._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {patches: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinks = body.data.links.to.patches
      t.assert(5 === patchLinks.length)
      t.assert(lastLinkId > patchLinks[0]._id)
      test.done()
    })
  })
}

exports.findLinksPagingWorksWithFilter = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    t.assert(5 === patchLinks.length)
    var lastLinkId = patchLinks[4]._id
    var lastPatchId = patchLinks[4].document._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {patches: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinks = body.data.links.to.patches
      t.assert(5 === patchLinks.length)
      t.assert(lastLinkId > patchLinks[0]._id)
      test.done()
    })
  })
}


exports.findLinksCountWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, from: {users: 1}, count: true}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links.to.patches === ((2 * cPatches) + 1))  // everybody likes and watches and one creates
    t.assert(body.data.links.from.users === ((cUsers * 2) - 2))  // everybody but user1 likes and watches her
    test.done()
  })
}

exports.findLinksAcceptsArrays = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: [{to: {patches: 1}}, {from: {users: 1}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.length === 2)  // nested in an array
    t.assert(body.data.links[0].to)
    t.assert(body.data.links[0].to.patches)
    t.assert(body.data.links[1].from.users.length)
    t.assert(!body.data.links[0].to.users)
    t.assert(body.data.links[1].from)
    t.assert(body.data.links[1].from.users)
    t.assert(body.data.links[1].from.users.length)
    t.assert(!body.data.links[1].from.patches)
    test.done()
  })
}


exports.findLinksFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?links[from][users]=1&links[linkFilter][type]=watch&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.links.from.users.length === (cUsers - 1)) // everybody watches user1 except user1
    body.data.links.from.users.forEach(function(link) {
      t.assert(link.type === 'watch')
    })
    test.done()
  })
}
