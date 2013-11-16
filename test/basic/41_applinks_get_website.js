/**
 *  Proxibase applink get website test
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


exports.checkTwitterUrls = function(test) {
  return test.done()
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'website', appId: url}
      ],
      includeRaw: true},
  },
  function(err, res) {
    var applinks = res.body.data
    t.assert(applinks.length === 2)
    t.assert(applinks[0].type === 'website')
    var applink = applinks[1]
    t.assert(applink.name === '@bob')
    t.assert(applink.type === 'twitter')
    t.assert(applink.appId === 'bob')
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
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'website', appId: url}
      ],
      includeRaw: true,
      timeout: 20
    },
  }, function(err, res) {
    var applinks = res.body.data
    t.assert(applinks.length === 5)
    // make a map of the results array by id
    var map = {}
    applinks = applinks.slice(1)
    applinks.forEach(function(applink, i) {
      t.assert(applink.appId)
      t.assert(applink.type === 'facebook')
      t.assert(applink.photo)
      t.assert(applink.photo.prefix)
      t.assert(applink.data)
      t.assert(applink.data.origin === 'website')
      t.assert(applink.data.originId === url)
      map[applink.appId] = applink
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
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'website', appId: serviceUri + '/test/email.html'}
      ],
    }
  },
  function(err, res) {
    var applinks = res.body.data
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'email')
    t.assert(applinks[1].appId === 'george@3meters.com')
    test.done()
  })
}


exports.checkEmailUrlsWithGet = function(test) {
  t.get({uri: '/applinks/get?applinks[0][type]=website' +
    '&applinks[0][appId]=' + serviceUri + '/test/email.html'},
  function(err, res) {
    var applinks = res.body.data
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'email')
    t.assert(applinks[1].appId === 'george@3meters.com')
    test.done()
  })
}



// This test won't work when connecting through a tmobile hotspot and
// possibly other walled gardens, so removing for now
exports.getApplinksFailsProperlyOnBogusWebsite = function(test) {
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

exports.getGoogle = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'website', appId: 'www.google.com'}]
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


exports.getMassenaModern = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [{type: 'website', appId: 'http://www.massenamodern.com'}],
    }
  },
  function(err, res, body) {
    var applinks = body.data
    t.assert(applinks.length === 2)
    t.assert(applinks[1].type === 'twitter')
    t.assert(applinks[1].appId === 'massenamodern')
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
      applinks: [{type: 'website', appId: 'www.yahoo.com'}],
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

