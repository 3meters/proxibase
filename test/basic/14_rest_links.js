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

exports.findLinksNoDocumentsWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, docFields: false}},
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

exports.findLinksFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, docFields: 'name', fields: 'type'}}
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

exports.findLinksLinkFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.linked)
    t.assert(body.data.linked.length === dbProfile.ppu)
    test.done()
  })
}

exports.findLinksLinkDocFilterWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: 'patches', docFilter: {namelc: 'test patch 3'}}}
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


exports.findLinksSortsDescendingByLinkIdByDefault = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}}}
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


exports.findLinksSortWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}, sort: [{_id: 1}]}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    var lastLinkId = ''
    patchLinked.forEach(function(doc) {
      t.assert(doc.link)
      t.assert(doc.link._id > lastLinkId, {current: doc.link, previous: lastLinkId})
      lastLinkId = doc.link._id
    })
    query.body.links.sort[0]._id = -1 // descending by link id
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


exports.findLinksPagingWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, limit: 5, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(5 === patchLinked.length)
    var lastLinkId = patchLinked[4].link._id
    var lastPatchId = patchLinked[4]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: {patches: 1}, limit: 5, skip: 5, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      t.assert(5 === patchLinked.length)
      t.assert(lastLinkId > patchLinked[0].link._id)
      test.done()
    })
  })
}

exports.findLinksPagingWorksWithFilter = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}, limit: 2, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinked = body.data.linked
    t.assert(2 === patchLinked.length)
    var lastLinkId = patchLinked[1].link._id
    var lastPatchId = patchLinked[1]._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: 'patches', filter: {type: 'watch'}, limit: 2, skip: 2, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinked = body.data.linked
      t.assert(2 === patchLinked.length)
      t.assert(lastLinkId > patchLinked[0].link._id)
      test.done()
    })
  })
}


exports.findLinksCountWorks = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {links: {to: 'places,beacons,documents', from: {users: 1, messages: 1}, count: true}}
  }
  t.post(query, function(err, res, body) {
    t.assert(!body.data.linked)
    var linkedCount = body.data.linkedCount
    t.assert(linkedCount.to)
    t.assert(tipe.isDefined(linkedCount.to.places))
    t.assert(tipe.isDefined(linkedCount.to.beacons))
    t.assert(tipe.isDefined(linkedCount.to.documents))
    t.assert(linkedCount.from)
    t.assert(tipe.isDefined(linkedCount.from.users))
    t.assert(tipe.isDefined(linkedCount.from.messages))
    t.assert(linkedCount.to.documents === 0)
    t.assert(linkedCount.to.places === dbProfile.ppp)
    t.assert(linkedCount.to.beacons === dbProfile.bpp)
    t.assert(linkedCount.from.users === 2)  // watch and create
    t.assert(linkedCount.from.messages === dbProfile.mpp)
    test.done()
  })
}

exports.findLinksAcceptsArrays = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {links: [{to: {places: 1}}, {from: {users: 1}}]}
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


exports.findLinksFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?links[from][users]=1&links[filter][type]=watch&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.linked.length === 1)  // create links filtered out
    t.assert(body.data.linked[0].link)
    t.assert(body.data.linked[0].link.type === 'watch')
    test.done()
  })
}


exports.findLinksWorksWithArrays = function(test) {
var query = {
    uri: '/find/patches?links[from][users]=1&links[filter][type]=watch&refs=name&' + userCred,
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
