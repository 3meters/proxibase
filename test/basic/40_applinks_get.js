/**
 *  Proxibase applink get test
 */

var util = require('proxutils')
var log = util.log
var serviceUri = util.config.service.uri
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var userCred
var adminCred
var _exports = {} // for commenting out tests



exports.ensureFailsProperlyOnEmpty = function(test) {
  t.post({
    uri: '/applinks/get',
    body: {applinks: []}
  }, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(400.13 === body.error.code)
    test.done()
  })
}


// The Ballroom Seattle's facebook page is invisible to non-logged-in facebook
// users because it serves alcohol. The service should return this applink
// unvalidated and hope for the best on the client where the user can authenticate
// with facebook directly
exports.nonPublicFacebookPlaceFailsValidation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'facebook', appId: '235200356726'}],
    }
  }, function(err, res, body) {
    t.assert(0 === body.data.length)
    test.done()
  })
}

exports.checkBogusApplinks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'foursquare', appUrl: 'http://www.google.com'}],
    }
  },
  function(err, res, body) {
    t.assert(body.data.length === 0)
    test.done()
  })
}

exports.getApplinksFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'factual', appId: '46aef19f-2990-43d5-a9e3-11b78060150c'}],
      includeRaw: true, 
      timeout: 20
    }
  },
  function(err, res) {
    var applinks = res.body.data
    t.assert(applinks.length > 4)
    t.assert(res.body.raw)
    t.assert(res.body.raw.initialApplinks)
    t.assert(res.body.raw.factualCandidates.length > 12)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
          && applink.photo
          && applink.photo.prefix
          && applink.data.origin === 'factual'
          && applink.data.validated
          && applink.data.popularity
      )
    }))
    test.done()
  })
}

// Combine with next?
exports.getFactualApplinksFromFoursquareId = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'foursquare', appId: '4abebc45f964a520a18f20e3'}],
      includeRaw: true,
      timeout: 20
    } // Seattle Ballroom in Fremont
  },
  function(err, res, body) {
    var applinks = body.data
    t.assert(applinks.length > 3)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
          && applink.appId === '4abebc45f964a520a18f20e3'
          && applink.name === 'The Ballroom'
        )
    }))
    t.assert(!applinks.some(function(applink) { // facebook should not exist because it
      return (applink.type === 'facebook')      // cannot be validated because it serves
    }))                                         // alcohal and is hidden from the public API
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'yelp')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'website')
    }))
    applinks.forEach(function(applink) {
      t.assert(applink.type !== 'factual')
    })
    test.done()
  })
}

// Combine with previous?
exports.compareFoursquareToFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'foursquare', appId: '4abebc45f964a520a18f20e3'}],
      includeRaw: true,
      timeout: 20
    }
  },
  function(err, res) {
    var applinks4s = res.body.data
    t.assert(applinks4s.some(function(applink) {
      return (applink.type === 'foursquare'
        && applink.appId === '4abebc45f964a520a18f20e3'
        && applink.data.validated
        && applink.photo
        && applink.photo.prefix
        && applink.photo.suffix
        && !applink.icon
      )
    }))
    applinks4s.forEach(function(applink) {
      t.assert(applink.type !== 'factual')
    })
    t.assert(applinks4s.length > 3)
    t.post({
      uri: '/applinks/get',
      // Seattle Ballroom
      body: {
        applinks: [{type: 'factual', appId: '46aef19f-2990-43d5-a9e3-11b78060150c'}],
        includeRaw: true,
        timeout: 20
      }
    }, function(err, res) {
      var applinksFact = res.body.data
      t.assert(applinksFact.length > 3)
      t.assert(applinksFact.length === applinks4s.length, {applinks4s: applinks4s})
      test.done()
    })
  })
}

exports.getFacebookFromPlaceJoinWithFoursquare = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{
        type: 'foursquare',
        appId: '42893400f964a5204c231fe3',
        name: 'The Red Door',
        photo: {
          prefix: 'http://www.myimage.com/foo.jpeg',
          source: 'aircandi'
        },
      }],
      includeRaw: true,
      timeout: 20,
    },
  },
  function(err, res, body) {
    var applinks = body.data
    t.assert(applinks && applinks.length)
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'foursquare'
        && applink.appId === '42893400f964a5204c231fe3'
        && applink.data
        && applink.data.validated
        && applink.data.popularity > 5
        && applink.photo
        && applink.photo.prefix !== 'http://www.myimage.com/foo.jpeg' // overwrote photo
        && applink.photo.source === 'foursquare')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'facebook'
        && applink.appId === '155509047801321'
        && applink.name
        && applink.data
        && applink.data.validated
        && applink.data.popularity > 5
        && applink.photo
        && applink.photo.prefix
        && applink.photo.source === 'facebook')
    }))
    t.assert(applinks.some(function(applink) {
      return (applink.type === 'yelp'
        && applink.appId === 'q20FkqFbmdOhfSEhaT5IHg'
        && applink.name
        && applink.data
        && applink.data.validated
        && applink.data.popularity > 5)
    }))
    t.assert(applinks.every(function(applink) {
      return (applink.appId !== '427679707274727'  // This facebook entry fails the popularity contest
        && !applink.icon)  // depricated
    }))
    var raw = res.body.raw
    t.assert(raw)
    t.assert(raw.facebookCandidates)
    t.assert(raw.factualCandidates)
    t.assert(raw.facebookCandidates.length >= 1)
    t.assert(raw.factualCandidates.length >= 12)
    test.done()
  })
}


exports.appLinkPositionSortWorks = function(test) {
  if (disconnected) return skip(test)
  var startTime = util.now()
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'facebook', position: 10, _id: 'foo', appId: '155509047801321'},
        {type: 'website', appId: 'www.reddoorseattle.com'},
        {type: 'yelp', appId: 'q20FkqFbmdOhfSEhaT5IHg'},
        {type: 'foursquare', appId: '42893400f964a5204c231fe3'},
      ],
      timeout: 10
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    var wb, fb, fs, yl
    body.data.forEach(function(applink) {
      switch (applink.type) {
        case 'website':
          ws = true
          t.assert(!fb)
          t.assert(!fs)
          t.assert(!yl)
          assertValidated(applink)
          break

        case 'facebook':
          fb = true
          t.assert(10 === applink.position)  // proves position is passed through and ignored
          t.assert('foo' === applink._id)    // proves _id passthrough
          t.assert(ws)
          t.assert(!fs)
          t.assert(!yl)
          assertValidated(applink)
          break

        case 'foursquare':
          fs = true
          t.assert(ws)
          t.assert(fb)
          t.assert(!yl)
          assertValidated(applink)
          break

        case 'yelp':
          yl = true
          t.assert(ws)
          t.assert(fb)
          t.assert(fs)
          assertValidated(applink)
          break
      }
    })
    t.assert(yl)

    function assertValidated(applink) {
      t.assert(applink.data)
      t.assert(applink.data.validated)
      t.assert(applink.data.validated >= startTime)
    }

    test.done()
  })
}

// kosamai has two valid yelp entries
exports.appLinkPopularitySortWorks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'yelp', appId: 'fH7CPQ8194yGgSKK0fL-sg'},   // 45 reviews
        {type: 'yelp', appId: 'QYv7LvaoyuaEJRDRpPtFDQ'},   // 132 reviews
      ],
    }
  }, function(err, res, body) {
    t.assert(body.data.length === 2)
    t.assert(body.data[0].appId === 'QYv7LvaoyuaEJRDRpPtFDQ')
    test.done()
  })
}
