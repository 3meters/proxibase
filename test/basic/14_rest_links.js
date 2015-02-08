/*
 *  Proxibase rest linked basic test
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
var patch1Id = 'pa.010101.00000.555.000001'
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


exports.findLinkedFailProperlyOnBadInputs = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + adminCred,
    body: {linked: {to: {fakeCollection: 1}}},
  }
  t.post(query, 400, function(err, res, body) {
    t.assert(400.13 === body.error.code)
    test.done()
  })
}

exports.findLinkedWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + adminCred,
    body: {linked: {to: {patches: 1}}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    var linked = body.data.linked
    var cWatch = 0
    var cCreate = 0
    linked.forEach(function(linked) {

      t.assert(linked)
      t.assert(linked._id)
      t.assert(linked.schema === 'patch')
      t.assert(linked.link)
      var link = linked.link
      t.assert(link._id)
      switch (link.type) {
        case 'watch': cWatch++; break
        case 'create': cCreate++; break
      }
    })
    t.assert(cWatch === dbProfile.ppu)
    t.assert(cCreate === dbProfile.ppu)
    test.done()
  })
}

exports.findLinkedNoDocumentsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, docFields: false}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    var linked = body.data.linked
    t.assert(linked.length === (2 * dbProfile.ppu))  // same as above
    linked.forEach(function(doc) {
      t.assert(doc.link)
      t.assert(doc.link._to)
      t.assert(doc.link._from)
    })
    test.done()
  })
}

exports.findLinkedFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, docFields: 'name', fields: 'type'}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    var linked = body.data.linked
    t.assert(linked.length === 2 * dbProfile.ppu)
    linked.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(doc.collection === 'patches')
      t.assert(doc._owner)
      t.assert(!doc._creator)
      t.assert(doc.link)
      t.assert(doc.link._id)
      t.assert(doc.link._to)
      t.assert(doc.link._from)
      t.assert(doc.link.type)
      t.assert(!doc.link.modifiedDate)
    })
    test.done()
  })
}

exports.findLinkedFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, filter: {type: 'watch'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    t.assert(body.data.linked.length === dbProfile.ppu)
    test.done()
  })
}

exports.findLinkedLinkDocFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: 'patches', docFilter: {namelc: 'test patch 3'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.linked)
    var linked = body.data.linked
    t.assert(2 === linked.length) // watch and create
    linked.forEach(function(doc) {
      t.assert(doc.name.indexOf('Test Patch 3') === 0)
    })
    test.done()
  })
}


exports.findLinkedSortsDescendingByLinkIdByDefault = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    var lastLinkId = 'zzzzzzzz'
    patchLinked.forEach(function(doc) {
      t.assert(doc.link)
      t.assert(doc.link._id < lastLinkId, {current: doc.link._id, previous: lastLinkId})
      lastLinkId = doc.link._id
    })
    test.done()
  })
}


exports.findLinkedSortWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, filter: {type: 'watch'}, sort: [{_id: 1}]}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    var lastLinkId = ''
    patchLinked.forEach(function(doc) {
      t.assert(doc.link)
      t.assert(doc.link._id > lastLinkId, {current: doc.link, previous: lastLinkId})
      lastLinkId = doc.link._id
    })
    query.body.linked.sort[0]._id = -1 // descending by link id
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      var lastLinkId = 'zzzzzzzz'
      patchLinked.forEach(function(doc) {
        t.assert(doc.link._id < lastLinkId, {current: doc.link, previous: lastLinkId})
        lastLinkId = doc.link._id
      })
      test.done()
    })
  })
}


exports.findLinkedPagingWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(5 === patchLinked.length)
    var lastLinkId = patchLinked[4].link._id
    var lastPatchId = patchLinked[4]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {linked: {to: {patches: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      t.assert(5 === patchLinked.length)
      t.assert(lastLinkId > patchLinked[0].link._id)
      test.done()
    })
  })
}

exports.findLinkedPagingWorksWithFilter = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, filter: {type: 'watch'}, limit: 2, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(2 === patchLinked.length)
    var lastLinkId = patchLinked[1].link._id
    var lastPatchId = patchLinked[1]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {linked: {to: 'patches', filter: {type: 'watch'}, limit: 2, skip: 2, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      t.assert(2 === patchLinked.length)
      t.assert(lastLinkId > patchLinked[0].link._id)
      test.done()
    })
  })
}


exports.findLinkedCountWorks = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {linked: [
      {to: 'places,beacons,documents', type: 'proximity', count: true},
      {from: {users: 1}, type: 'watch', count: 1},
      {from: {users: 1}, type: 'create', count: 1},
      {from: {messages: 1}, type: 'content', count: 1},
    ]},
  }
  t.post(query, function(err, res, body) {
    t.assert(!body.data.linked)
    var lc = body.data.linkedCount
    t.assert(lc.to)
    t.assert(tipe.isDefined(lc.to.places.proximity))
    t.assert(tipe.isDefined(lc.to.beacons.proximity))
    t.assert(tipe.isDefined(lc.to.documents.proximity))
    t.assert(lc.from)
    t.assert(tipe.isDefined(lc.from.users.watch))
    t.assert(tipe.isDefined(lc.from.messages.content))
    t.assert(lc.to.documents.proximity === 0)
    t.assert(lc.to.places.proximity === dbProfile.ppp)
    t.assert(lc.to.beacons.proximity === dbProfile.bpp)
    t.assert(lc.from.users.watch === 1)
    t.assert(lc.from.users.create === 1)
    t.assert(lc.from.messages.content === dbProfile.mpp)
    test.done()
  })
}


exports.findLinkedAcceptsArrays = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {linked: [{to: {places: 1}}, {from: {users: 1}}]}
  }
  t.post(query, function(err, res, body) {
    var linked = body.data.linked
    t.assert(linked)
    t.assert(linked.length === dbProfile.ppp + 2)  // like and watch
    var cFrom = 0
    var cTo = 0
    linked.forEach(function(doc) {
      t.assert(doc.link)
      if (doc.schema === 'user') cFrom++
      if (doc.schema === 'place') cTo++
    })
    t.assert(cFrom === 2)  // like and watch
    t.assert(cTo == dbProfile.ppp)  // places per patch
    test.done()
  })
}


exports.mustSpecifyTypeForLinkCount = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {linked: {from: 'messages', count: true}},
  }
  t.post(query, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.code === 400.13)
    test.done()
  })
}


exports.findLinkedComplexWorks = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {linked: [
      {to: 'places,beacons', type: 'proximity', count: true},
      {from: 'users', type: 'watch', count: true},
      {from: 'users', type: 'create', count: true},
      {from: 'messages', type: 'content', count: true},
      {from: 'messages', type: 'content'},  // get documents not count
    ]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linkedCount)
    var lc = body.data.linkedCount
    t.assert(tipe.isDefined(lc.to.places.proximity))
    t.assert(tipe.isDefined(lc.to.beacons.proximity))
    t.assert(tipe.isDefined(lc.from.users.watch))
    t.assert(tipe.isDefined(lc.from.messages.content))
    t.assert(lc.to.beacons.proximity === dbProfile.bpp)
    t.assert(lc.to.places.proximity === dbProfile.ppp)
    t.assert(lc.from.users.watch === 1)
    t.assert(lc.from.users.create === 1)
    t.assert(lc.from.messages.content === dbProfile.mpp)
    // Can mix and match count queries with data-fetching queries
    t.assert(body.data.linked)
    body.data.linked.forEach(function(doc) {
      t.assert(doc.collection === 'message')
      t.assert(doc.link)
      t.assert(doc.link.type === 'content')
    })
    test.done()
  })
}


exports.findLinkedFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id +
      '?linked[from][users]=1&linked[filter][type]=watch&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.linked.length === 1)  // create filtered out
    t.assert(body.data.linked[0].link)
    t.assert(body.data.linked[0].link.type === 'watch')
    test.done()
  })
}


exports.findLinkedWorksWithArrays = function(test) {
var query = {
    uri: '/find/patches?linked[from][users]=1&linked[filter][type]=watch&refs=name&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length)
    var cLinked = 0
    body.data.forEach(function(patch) {
      t.assert(patch.linked)
      patch.linked.forEach(function(doc) {
        cLinked++
        t.assert(doc.link)
        t.assert(doc.link.type === 'watch')
        t.assert(doc._owner)
        t.assert(doc.owner)  // refs work on doc
      })
    })
    t.assert(cLinked > 10)
    test.done()
  })
}


exports.findLinksReturnsLinksNotDocuments = function(test) {
var query = {
    uri: '/find/patches?links[from][users]=1&links[filter][type]=watch&refs=name&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length)
    var cWatchLinks = 0
    body.data.forEach(function(patch) {
      patch.links.forEach(function(link) {
        t.assert(link._id)
        t.assert(link.collection === 'links')
        t.assert(link.schema === 'link')
        t.assert(link.type === 'watch')
        t.assert(link.fromSchema === 'user')
        t.assert(link.toSchema === 'patch')
        cWatchLinks++
      })
    })
    t.assert(cWatchLinks > 10)
    test.done()
  })
}
