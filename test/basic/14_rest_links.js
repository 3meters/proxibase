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
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    var cWatch = 0
    var cCreate = 0
    links.to.patches.forEach(function(link) {
      t.assert(link._id)
      t.assert(link.document)
      t.assert(link.document._id)
      t.assert(link.document.schema === 'patch')
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
    body: {links: {to: {patches: 1}, docFields: -1}},
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(links.to.patches.length === (2 * dbProfile.ppu))  // same as above
    links.to.patches.forEach(function(link) {
      t.assert(!link.document)
    })
    test.done()
  })
}

exports.findLinksFieldProjectionWorks = function(test) {
  var query = {
    uri: '/find/users/' + user1Id + '?' + userCred,
    body: {links: {to: {patches: 1}, docFields: {name: 1}, fields: {type: 1}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(links.to.patches.length === 2 * dbProfile.ppu)
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
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(links.to.patches.length === dbProfile.ppu)
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
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to)
    t.assert(links.to.patches)
    t.assert(2 === links.to.patches.length) // watch and create
    links.to.patches.forEach(function(link) {
      t.assert(link.document.name.indexOf('Test Patch 3') === 0)
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
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}, sort: [{_id: 1}]}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    var lastLinkId = ''
    patchLinks.forEach(function(link) {
      t.assert(link._id > lastLinkId, {current: link, previous: lastLinkId})
      lastLinkId = link._id
    })
    query.body.links.sort[0]._id = -1 // descending by link id
    t.post(query, function(err, res, body) {
      var patchLinks = body.data.links.to.patches
      var lastLinkId = 'zzzzzzzz'
      patchLinks.forEach(function(link) {
        t.assert(link._id < lastLinkId, {current: link, previous: lastLinkId})
        lastLinkId = link._id
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
    body: {links: {to: {patches: 1}, filter: {type: 'watch'}, limit: 2, sort: '-_id'}}
  }
  t.post(query, function(err, res, body) {
    var patchLinks = body.data.links.to.patches
    t.assert(2 === patchLinks.length)
    var lastLinkId = patchLinks[1]._id
    var lastPatchId = patchLinks[1].document._id
    var query = {
      uri: '/find/users/' + user1Id + '?' + userCred,
      body: {links: {to: 'patches', filter: {type: 'watch'}, limit: 2, skip: 2, sort: '-_id'}}
    }
    t.post(query, function(err, res, body) {
      var patchLinks = body.data.links.to.patches
      t.assert(2 === patchLinks.length)
      t.assert(lastLinkId > patchLinks[0]._id)
      test.done()
    })
  })
}


exports.findLinksCountWorks = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {links: {to: 'places,beacons', from: {users: 1, messages: 1}, count: true}}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    var links = body.data.links
    t.assert(links.to.places === dbProfile.ppp)
    t.assert(links.to.beacons === dbProfile.bpp)
    t.assert(links.from.users === 2)  // watch and create
    t.assert(links.from.messages === dbProfile.mpp)
    test.done()
  })
}

exports.findLinksAcceptsArrays = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?' + userCred,
    body: {links: [{to: {places: 1}}, {from: {users: 1}}]}
  }
  t.post(query, function(err, res, body) {
    t.assert(body.data.links)
    t.assert(body.data.links.length === 2)  // nested in an array
    t.assert(body.data.links[0].to)
    t.assert(body.data.links[0].to.places)
    t.assert(body.data.links[0].to.places.length === dbProfile.ppp)
    t.assert(!body.data.links[0].to.users)
    t.assert(body.data.links[1].from)
    t.assert(body.data.links[1].from.users)
    t.assert(body.data.links[1].from.users.length === 2)
    t.assert(!body.data.links[1].from.places)
    test.done()
  })
}


exports.findLinksFromWorksWithGetSyntax = function(test) {
  var query = {
    uri: '/find/patches/' + patch1Id + '?links[from][users]=1&links[filter][type]=watch&' + userCred,
  }
  t.get(query, function(err, res, body) {
    t.assert(body.data.links.from.users.length === 1)  // create links filtered out
    body.data.links.from.users[0].type === 'watch'
    test.done()
  })
}
