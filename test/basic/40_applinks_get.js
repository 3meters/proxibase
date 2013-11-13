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


// This test won't work when connecting through a tmobile hotspot and
// possibly other walled gardens, so removing for now
_exports.getApplinksFailsProperlyOnBogusWebsite = function(test) {
  if (disconnected) return skip(test)
  return test.done()
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'website', appUrl: 'www.iamabogusurlhaha.com'}]
    }
  }, function(err, res, body) {
    t.assert(0 === body.data.length)
    test.done()
  })
}

exports.getApplinksWorksOnWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'website', appUrl: 'www.google.com'}]
    }
  }, function(err, res, body) {
    t.assert(1 === body.data.length)
    var result = body.data[0]
    t.assert(result.appUrl === 'http://www.google.com')
    t.assert(result.appId === 'http://www.google.com')
    t.assert(result.photo)
    t.assert(result.photo.prefix === 'www.google.com.png')
    t.assert(result.data)
    t.assert(result.data.validated)
    test.done()
  })
}

exports.getWebsiteWaitForContent = function(test) {
  // TODO:  once we have a public photo service, delete this
  // thumbnail from s3 and check to see that it is recreated properly.
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'website', appUrl: 'www.yahoo.com'}],
      waitForContent: true,
      testThumbnails: true,
      timeout: 15,
    }
  }, function(err, res, body) {
    t.assert(1 === body.data.length)
    var result = body.data[0]
    t.assert(result.appUrl === 'http://www.yahoo.com')
    t.assert(result.appId === 'http://www.yahoo.com')
    t.assert(result.photo)
    t.assert(result.photo.prefix === 'www.yahoo.com.png')
    t.assert(result.data)
    t.assert(result.data.validated)
    test.done()
  })
}


exports.getFoursquare = function(test) {
  if (disconnected) return skip(test)
  var started = util.now()
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{
        type: 'foursquare',
        appId: '4abebc45f964a520a18f20e3', // Seattle ballroom
        photo: {
          prefix: 'http://www.myimage.com/foo.jpeg',
          source: 'aircandi'
        },
      }]
    }
  }, function(err, res, body) {
    t.assert(body.data.length)
    body.data.forEach(function(applink) {
      if ('foursquare' === applink.type) {
        // we overwrite user photos with provider photos on get
        t.assert(applink.photo)
        t.assert('http://www.myimage.com/foo.jpeg' !== applink.photo.prefix)
        t.assert('foursquare' === applink.photo.source)
        t.assert(applink.data)
        t.assert(started <= applink.data.validated)
      }
    })
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
        {type: 'facebook', position: 1, appId: '155509047801321'},
        {type: 'website', appId: 'www.reddoorseattle.com'},
        {type: 'yelp', appId: 'q20FkqFbmdOhfSEhaT5IHg'},
        {type: 'foursquare', appId: '42893400f964a5204c231fe3'},
      ],
      timeout: 10
    }
  }, function(err, res, body) {
    t.assert(body.data && body.data.length)
    body.data.forEach(function(applink) {
      switch (applink.type) {
        case 'facebook':
        case 'website':
        case 'yelp':
        case 'foursquare':
          t.assert(applink.data)
          t.assert(applink.data.validated)
          t.assert(applink.data.validated >= startTime)
      }
    })
    return skip(test)  // Sort test is NYI
  })
}
