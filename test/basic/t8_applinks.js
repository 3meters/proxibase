/**
 *  Proxibase local suggest applinks test
 */

var util = require('proxutils')
var log = util.log
var typeApplink = util.statics.typeApplink
var serviceUri = util.config.service.uri
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var userCred
var adminCred
var _exports = {} // for commenting out tests


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.errorOnUnknownParams = function(test) {
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/suggest',
    body: {foo: 'bar', appLinkEnts: [], includeRaw: true}
  }, 400,
  function(err, res, body) {
    t.assert(body && body.error)
    t.assert(body.error.code === 400.11)  // badParam
    t.assert(body.error.appStack)
    test.done()
  })
}

exports.ensureWorksWithEmpty = function(test) {
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/suggest',
    body: {}
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(util._.isEmpty(body.data))
    test.done()
  })
}

exports.checkTwitterUrls = function(test) {
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/suggest',
    body: {applinkEnts: [
      {type: typeApplink, applink: {type: 'website', id: url}}
    ], includeRaw: true},
  },
  function(err, res) {
    var applinkEnts = res.body.data.applinkEnts
    t.assert(applinkEnts.length === 2)
    t.assert(applinkEnts[0].applink)
    t.assert(applinkEnts[0].applink.type === 'website')
    var ent = applinkEnts[1]
    t.assert(ent.name === '@bob')
    t.assert(ent.applink.type === 'twitter')
    t.assert(ent.applink.id === 'bob')
    t.assert(!ent.applink.icon)
    t.assert(ent.applink.data)
    t.assert(ent.applink.data.origin === 'website')
    t.assert(ent.applink.data.originId === url)
    t.assert(res.body.raw.webSiteCandidates.length === 6)
    test.done()
  })
}

exports.checkFacebookUrls = function(test) {
  if (disconnected) return skip(test) // test calls facebook
  var url = serviceUri + '/test/facebook.html'
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [
      {type: 'website', id: url}
    ]}}},
  function(err, res) {
    var sources = res.body.data.sources
    t.assert(sources.length === 5)
    // make a map of the results array by id
    var map = {}
    sources = sources.slice(1)
    sources.forEach(function(source, i) {
      t.assert(source.id)
      t.assert(source.type === 'facebook')
      t.assert(!source.icon)
      t.assert(source.packageName)
      t.assert(source.photo)
      t.assert(source.photo.prefix)
      t.assert(source.data)
      t.assert(source.data.origin === 'website')
      t.assert(source.data.originId === url)
      map[source.id] = source
    })
    t.assert(Object.keys(map).length === sources.length)  // no dupes by id
    t.assert(map['620955808'])
    t.assert(map['620955808'].name === 'George Snelling')
    t.assert(map['227605257298019'])
    t.assert(map['284314854066'])
    t.assert(map['115450755150958'])
    test.done()
  })
}

exports.checkEmailUrls = function(test) {
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [
      {type: 'website', id: serviceUri + '/test/email.html'}
    ]}}
  },
  function(err, res) {
    var sources = res.body.data.sources
    t.assert(sources.length === 2)
    t.assert(sources[1].type === 'email')
    t.assert(sources[1].id === 'george@3meters.com')
    test.done()
  })
}


exports.checkEmailUrlsWithGet = function(test) {
  t.get({uri: '/applinks/suggest?entity[sources][0][type]=website' +
    '&entity[sources][0][id]=' + serviceUri + '/test/email.html'},
  function(err, res) {
    var sources = res.body.data.sources
    t.assert(sources.length === 2)
    t.assert(sources[1].type === 'email')
    t.assert(sources[1].id === 'george@3meters.com')
    test.done()
  })
}

// The Ballroom Seattle's facebook page is invisible to non-logged-in facebook
// users because it serves alcohol. The service should return this source
// unvalidated and hope for the best on the client where the user can authenticate
// with facebook directly
exports.notFoundFacebookApplinkPassesThroughUnvalidated = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'facebook', id: '235200356726'}]}}
  }, function(err, res, body) {
    var sources = body.data.sources
    t.assert(sources && 1 === sources.length)
    var source = sources[0]
    t.assert(source.id === '235200356726')
    t.assert(source.data)
    t.assert(!source.data.validated)
    t.assert(!source.photo)
    test.done()
  })
}

exports.checkBogusApplinks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'foursquare', url: 'http://www.google.com'}]}}
  },
  function(err, res, body) {
    t.assert(body.data.sources.length === 0)
    test.done()
  })
}

exports.suggestApplinksFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'factual', id: '46aef19f-2990-43d5-a9e3-11b78060150c'}]},
             includeRaw: true}
  },
  function(err, res) {
    var sources = res.body.data.sources
    t.assert(sources.length > 4)
    t.assert(sources[0].type === 'factual')
    t.assert(sources[0].system)
    t.assert(res.body.raw)
    t.assert(res.body.raw.initialApplinks)
    t.assert(res.body.raw.factualCandidates.length > 12)
    t.assert(sources.some(function(source) {
      return (source.type === 'foursquare'
          && source.photo
          && source.photo.prefix
          && source.data.origin === 'factual'
          && source.data.validated
          && source.data.checkinsCount
      )
    }))
    test.done()
  })
}

// Combine with next?
exports.suggestFactualApplinksFromFoursquareId = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]}} // Seattle Ballroom in Fremont
  },
  function(err, res, body) {
    var sources = body.data.sources
    t.assert(sources.length > 3)
    t.assert(sources.some(function(source) {
      return (source.type === 'foursquare'
          && source.id === '4abebc45f964a520a18f20e3'
        )
    }))
    t.assert(sources.some(function(source) {
      return (source.type === 'facebook')
    }))
    t.assert(sources.some(function(source) {
      return (source.type === 'factual')
    }))
    t.assert(sources.some(function(source) {
      return (source.type === 'website')
    }))
    test.done()
  })
}

// Combine with previous?
exports.compareFoursquareToFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]}}  // Seattle Ballroom
  },
  function(err, res) {
    var sources4s = res.body.data.sources
    t.assert(sources4s.some(function(source) {
      return (source.type === 'foursquare'
        && source.id === '4abebc45f964a520a18f20e3'
        && source.data.validated
        && source.photo
        && source.photo.prefix
        && source.photo.suffix
        && !source.icon
      )
    }))
    t.assert(sources4s.some(function(source) {
      return (source.type === 'factual'
        && source.data.validated
        && source.system
        && !source.photo
        && !source.icon
      )
    }))
    t.assert(sources4s.length > 3)
    t.post({
      uri: '/applinks/suggest',
      // Seattle Ballroom
      body: {entity: {sources: [{type: 'factual', id: '46aef19f-2990-43d5-a9e3-11b78060150c'}]},
             includeRaw: true}
    }, function(err, res) {
      var sourcesFact = res.body.data.sources
      t.assert(sourcesFact.length > 3)
      t.assert(sourcesFact.length === sources4s.length)
      test.done()
    })
  })
}

exports.getFacebookFromPlaceJoinWithFoursquare = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {
      entity: {
        name: 'The Red Door',
        place: {lat: 47.65, lng: -122.35},
        sources: [{
          type: 'foursquare',
          id: '42893400f964a5204c231fe3',
          name: 'The Red Door',
        }],
      },
      includeRaw: true,
    },
  },
  function(err, res, body) {
    var sources = body.data.sources
    t.assert(sources && sources.length)
    t.assert(sources.some(function(source) {
      return (source.type === 'foursquare'
        && source.id === '42893400f964a5204c231fe3'
        && source.data
        && source.data.validated
        && source.photo
        && source.photo.prefix
        && source.photo.suffix
        && source.photo.sourceName === 'foursquare')
    }))
    t.assert(sources.some(function(source) {
      return (source.type === 'facebook'
        && source.id === '155509047801321'
        && source.name
        && source.data
        && source.data.validated
        && source.photo
        && source.photo.prefix
        && source.photo.sourceName === 'facebook')
    }))
    t.assert(sources.every(function(source) {
      return (source.id !== '427679707274727'  // This facebook entry fails the popularity contest
        && !source.icon)  // depricated
    }))
    var raw = res.body.raw
    t.assert(raw)
    t.assert(raw.facebookCandidates.length >= 2)
    t.assert(raw.factualCandidates.length >= 12)
    test.done()
  })
}

exports.suggestApplinksFromWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {entity: {sources: [{type: 'website', id: 'http://www.massenamodern.com'}]}}
  },
  function(err, res, body) {
    var sources = body.data.sources
    t.assert(sources.length === 2)
    t.assert(sources[1].type === 'twitter')
    t.assert(sources[1].id === 'massenamodern')
    test.done()
  })
}

exports.suggestApplinksUsingPlace = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {
      entity: {sources: [], // empty because user deleted them all
      place: {provider: {foursquare: '4abebc45f964a520a18f20e3'}}},
    },
    includeRaw: true,
  }, function(err, res, body) {
    var sources = body.data.sources
    t.assert(sources.length > 3)
    test.done()
  })
}