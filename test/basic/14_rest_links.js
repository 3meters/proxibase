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
    body: {linked: {to: {patches: 1}, linkFields:1 }},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.linked)
    var linked = body.data.linked
    var cWatch = 0
    var cCreate = 0
    linked.forEach(function(linked) {

      t.assert(linked)
      t.assert(linked._id)
      t.assert(linked.schema === 'patch')
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

exports.findLinksWithoutDocumentsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, fields: 'enabled'}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(!body.data.linked)
    var links = body.data.links
    t.assert(links.length === (2 * dbProfile.ppu))  // same as above
    links.forEach(function(link) {
      t.assert(link._to)
      t.assert(link._from)
      t.assert(link.enabled)
      t.assert(!link._creator)
    })
    test.done()
  })
}

exports.findLinkedFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, fields: 'name,schema', linkFields: 'type,enabled'}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    var linked = body.data.linked
    t.assert(linked.length === 2 * dbProfile.ppu)
    linked.forEach(function(doc) {
      t.assert(doc._id)
      t.assert(doc.name)
      t.assert(!doc.collection) // old property
      t.assert(doc.schema === 'patch')
      t.assert(doc._owner)
      t.assert(!doc._creator)
      t.assert(doc.link)
      t.assert(doc.link._id)
      t.assert(tipe.isDefined(doc.link.enabled))
      t.assert(doc.link.type)
      t.assert(!doc.link._to)
    })
    test.done()
  })
}


exports.findLinkedReturnsNoLinksByDefault = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, fields: 'name'}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    var linked = body.data.linked
    t.assert(linked.length === 2 * dbProfile.ppu)
    linked.forEach(function(doc) {
      t.assert(!doc.link)
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


exports.findLinkedFilterDocsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: 'patches', linkedFilter: {namelc: 'test patch 3'}}}
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
    body: {linked: {to: {patches: 1}, linkFields: true}}
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
    body: {linked: {to: {patches: 1}, filter: {type: 'watch'}, sort: [{_id:1}], linkFields: {}}}
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
    body: {linked: {to: {patches: 1}, limit: 5, sort: '-_id', linkFields:1}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(5 === patchLinked.length)
    t.assert(body.data.moreLinked)  // under data, not body
    var lastLinkId = patchLinked[4].link._id
    var lastPatchId = patchLinked[4]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {linked: {to: {patches: 1}, limit: 5, skip: 5, sort: '-_id', linkFields:1}}
    }
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      t.assert(5 === patchLinked.length)
      t.assert(!body.data.moreLinked)  // under data, not body
      t.assert(lastLinkId > patchLinked[0].link._id)
      var query = {
        uri: '/find/users/' + user1Id + '?' + userCred,
        body: {linkCount: [
          {to: "patches", type: "watch"},
          {to: "patches", type: "create"},
        ]}
      }
      t.post(query, function(err, res, body) {
        t.assert(body.data)
        t.assert(body.data.linkCount)
        t.assert(body.data.linkCount.to.patches.create === 5)
        t.assert(body.data.linkCount.to.patches.watch === 5)
        test.done()
      })
    })
  })
}

exports.findLinkedPagingWorksWithFilter = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {linked: {to: {patches: 1}, filter: {type: 'watch'}, limit: 2, sort: '-_id', linkFields:1}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(2 === patchLinked.length)
    var lastLinkId = patchLinked[1].link._id
    var lastPatchId = patchLinked[1]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {linked: {to: 'patches', filter: {type: 'watch'}, limit: 2, skip: 2, sort: '-_id', linkFields:1}}
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
    body: {linkCount: [
      {to: 'places,beacons,documents', type: 'proximity'},
      {from: {users: 1}, type: 'watch'},
      {from: {users: 1}, type: 'create'},
      {from: {messages: 1}, type: 'content'},
    ]},
  }
  t.post(query, function(err, res, body) {
    t.assert(!body.data.linked)
    var lc = body.data.linkCount
    t.assert(lc && lc.to)
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
    body: {linked: [{to: {places: 1}, linkFields: 1}, {from: {users: 1}, linkFields: '_id,schema'}]}
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
    body: {linkCount: {from: 'messages'}},
  }
  t.post(query, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.code === 400.1)
    test.done()
  })
}


exports.findLinkedComplexWorks = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {
      linkCount: [
        {to: 'places,beacons', type: 'proximity'},
        {from: 'users', type: 'watch'},
        {from: 'users', type: 'create'},
        {from: 'messages', type: 'content'},
      ],
      linked: [
        {from: 'messages', type: 'content', linkFields: {}},  // get documents not count
      ],
      links: {to: 'beacons', type: 'proximity'}
    }
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linkCount)
    var lc = body.data.linkCount
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
      t.assert(doc.schema === 'message')
      t.assert(doc.link)
      t.assert(doc.link.type === 'content')
    })
    t.assert(body.data.links)
    t.assert(body.data.links.length)
    body.data.links.forEach(function(link) {
      t.assert(link.toSchema === 'beacon')
      t.assert(link._from === patch1Id)
    })
    test.done()
  })
}


exports.findLinkedFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id +
      '?linked[from][users]=1&linked[type]=watch&linked[linkFields]=1&' + userCred,
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
    uri: '/find/patches?linked[from][users]=1&linked[type]=watch&linked[linkFields]=true&refs=name&' + userCred,
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
    uri: '/find/patches?limit=20&links[from][users]=1&links[limit]=1&refs=name' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length)
    var cCreateLinks = 0
    var cMoreLinks = 0
    body.data.forEach(function(patch) {
      if (patch.moreLinks) {
        cMoreLinks++
        // doc.moreLinksQueries is an array of selectors into the links collection
        // that have additional documents that were not returned due to the limit
        t.assert(patch.moreLinksQueries && patch.moreLinksQueries.length)
      }
      patch.links.forEach(function(link) {
        t.assert(link._id)
        t.assert(link.schema === 'link')
        t.assert(link.type === 'create')
        t.assert(link.fromSchema === 'user')
        t.assert(link.toSchema === 'patch')
        cCreateLinks++
      })
    })
    t.assert(cCreateLinks > 10, cCreateLinks)
    t.assert(cMoreLinks, cMoreLinks)
    test.done()
  })
}
