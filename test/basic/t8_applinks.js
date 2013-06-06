/**
 *  Proxibase local suggest applinks test
 */

var util = require('proxutils')
var log = util.log
var typeApplink = util.statics.schemaApplink
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

exports.ensureWorksWithEmpty = function(test) {
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/suggest',
    body: {}
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(util._.isEmpty(body.data.place))
    test.done()
  })
}

exports.checkTwitterUrls = function(test) {
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/suggest',
    body: {
      place: {
        applinks: [
          {type: 'website', id: url}
        ],
      },
      includeRaw: true},
  },
  function(err, res) {
    var applinks = res.body.data.place.applinks
    t.assert(applinks.length === 2)
    t.assert(applinks[0].type === 'website')
    var applink = applinks[1]
    t.assert(applink.name === '@bob')
    t.assert(applink.type === 'twitter')
    t.assert(applink.id === 'bob')
    t.assert(applink.data)
    t.assert(applink.data.origin === 'website')
    t.assert(applink.data.originId === url)
    t.assert(res.body.raw)
    t.assert(res.body.raw.webSiteCandidates)
    t.assert(res.body.raw.webSiteCandidates.length === 6)
    test.done()
  })
}

exports.checkFacebookUrls = function(test) {
  if (disconnected) return skip(test) // test calls facebook
  var url = serviceUri + '/test/facebook.html'
  t.post({
    uri: '/applinks/suggest',
    body: {
      place: {applinks: [
        {type: 'website', id: url}
      ]},
      includeRaw: true,
      timeout: 20
    },
  }, function(err, res) {
    var applinks = res.body.data.place.applinks
    t.assert(applinks.length === 5)
    // make a map of the results array by id
    var map = {}
    applinks = applinks.slice(1)
    applinks.forEach(function(applink, i) {
      t.assert(applink.id)
      t.assert(applink.type === 'facebook')
      t.assert(applink.photo)
      t.assert(applink.photo.prefix)
      t.assert(applink.data)
      t.assert(applink.data.origin === 'website')
      t.assert(applink.data.originId === url)
      map[applink.id] = applink
    })
    t.assert(Object.keys(map).length === applinks.length)  // no dupes by id
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
    body: {place: {applinks: [
      {type: 'website', id: serviceUri + '/test/email.html'}
    ]}}
  },
  function(err, res) {
    var applinks = res.body.data.place.applinks
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'email')
    t.assert(applinks[1].id === 'george@3meters.com')
    test.done()
  })
}


exports.checkEmailUrlsWithGet = function(test) {
  t.get({uri: '/applinks/suggest?place[applinks][0][type]=website' +
    '&place[applinks][0][id]=' + serviceUri + '/test/email.html'},
  function(err, res) {
    var applinks = res.body.data.place.applinks
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'email')
    t.assert(applinks[1].id === 'george@3meters.com')
    test.done()
  })
}

// The Ballroom Seattle's facebook page is invisible to non-logged-in facebook
// users because it serves alcohol. The service should return this applink
// unvalidated and hope for the best on the client where the user can authenticate
// with facebook directly
exports.notFoundFacebookApplinkPassesThroughUnvalidated = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {place: {applinks: [{type: 'facebook', id: '235200356726'}]}}
  }, function(err, res, body) {
    var applinks = body.data.place.applinks
    t.assert(applinks && 1 === applinks.length)
    var applink = applinks[0]
    t.assert(applink.id === '235200356726')
    t.assert(applink.data)
    t.assert(!applink.data.validated)
    t.assert(!applink.photo)
    test.done()
  })
}

exports.checkBogusApplinks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {place: {applinks: [{type: 'foursquare', url: 'http://www.google.com'}]}}
  },
  function(err, res, body) {
    t.assert(body.data.place.applinks.length === 0)
    test.done()
  })
}

exports.suggestApplinksFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {place: {applinks: [{type: 'factual', id: '46aef19f-2990-43d5-a9e3-11b78060150c'}]},
             includeRaw: true, timeout: 20}
  },
  function(err, res) {
    var applinks = res.body.data.place.applinks
    t.assert(applinks.length > 4)
    t.assert(applinks[0].type === 'factual')
    t.assert(applinks[0].system)
    t.assert(res.body.raw)
    t.assert(res.body.raw.initialApplinks)
    t.assert(res.body.raw.factualCandidates.length > 12)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
          && applink.photo
          && applink.photo.prefix
          && applink.data.origin === 'factual'
          && applink.data.validated
          && applink.data.checkinsCount
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
    body: {place: {applinks: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]},
    includeRaw: true,
    timeout: 20} // Seattle Ballroom in Fremont
  },
  function(err, res, body) {
    var applinks = body.data.place.applinks
    t.assert(applinks.length > 3)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
          && applink.id === '4abebc45f964a520a18f20e3'
        )
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'facebook')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'factual')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'website')
    }))
    test.done()
  })
}

// Combine with previous?
exports.compareFoursquareToFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {place: {applinks: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]}, // Seattle Ballroom
    includeRaw: true,
    timeout: 20}
  },
  function(err, res) {
    var applinks4s = res.body.data.place.applinks
    t.assert(applinks4s.some(function(applink) {
      return (applink.type === 'foursquare'
        && applink.id === '4abebc45f964a520a18f20e3'
        && applink.data.validated
        && applink.photo
        && applink.photo.prefix
        && applink.photo.suffix
        && !applink.icon
      )
    }))
    t.assert(applinks4s.some(function(applink) {
      return (applink.type === 'factual'
        && applink.data.validated
        && applink.system
        && !applink.photo
        && !applink.icon
      )
    }))
    t.assert(applinks4s.length > 3)
    t.post({
      uri: '/applinks/suggest',
      // Seattle Ballroom
      body: {
        place: {applinks: [{type: 'factual', id: '46aef19f-2990-43d5-a9e3-11b78060150c'}]},
        includeRaw: true,
        timeout: 20
      }
    }, function(err, res) {
      var applinksFact = res.body.data.place.applinks
      t.assert(applinksFact.length > 3)
      t.assert(applinksFact.length === applinks4s.length, {applinks4s: applinks4s})
      test.done()
    })
  })
}

exports.getFacebookFromPlaceJoinWithFoursquare = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {
      place: {
        name: 'The Red Door',
        location: {lat: 47.65, lng: -122.35},
        applinks: [{
          type: 'foursquare',
          id: '42893400f964a5204c231fe3',
          name: 'The Red Door',
        }],
      },
      includeRaw: true,
      timeout: 20,
    },
  },
  function(err, res, body) {
    var applinks = body.data.place.applinks
    t.assert(applinks && applinks.length)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
        && applink.id === '42893400f964a5204c231fe3'
        && applink.data
        && applink.data.validated
        && applink.photo
        && applink.photo.prefix
        && applink.photo.suffix
        && applink.photo.sourceName === 'foursquare')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'facebook'
        && applink.id === '155509047801321'
        && applink.name
        && applink.data
        && applink.data.validated
        && applink.photo
        && applink.photo.prefix
        && applink.photo.sourceName === 'facebook')
    }))
    t.assert(applinks.every(function(applink) {
      return (applink.id !== '427679707274727'  // This facebook entry fails the popularity contest
        && !applink.icon)  // depricated
    }))
    var raw = res.body.raw
    t.assert(raw)
    t.assert(raw.facebookCandidates)
    t.assert(raw.factualCandidates)
    t.assert(raw.facebookCandidates.length >= 2)
    t.assert(raw.factualCandidates.length >= 12)
    test.done()
  })
}

exports.suggestApplinksFromWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {place: {applinks: [{type: 'website', id: 'http://www.massenamodern.com'}]}}
  },
  function(err, res, body) {
    var applinks = body.data.place.applinks
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'twitter')
    t.assert(applinks[1].id === 'massenamodern')
    test.done()
  })
}

exports.suggestApplinksUsingPlace = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/suggest',
    body: {
      place: {
        provider: {foursquare: '4abebc45f964a520a18f20e3'},
        applinks: [], // empty because user deleted them all
      },
      includeRaw: true,
      timeout: 20,
    }
  }, function(err, res, body) {
    var applinks = body.data.place.applinks
    t.assert(applinks.length > 3)
    test.done()
  })
}
