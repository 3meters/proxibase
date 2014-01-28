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


// Issue 112
exports.getWebsiteWaitForContent = function(test) {
  // TODO:  once we have a public photo service, delete this
  // thumbnail from s3 and check to see that it is recreated properly.
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'website', appId: 'http://www.google.com?n=12345'},
      ],
      waitForContent: true,
      testThumbnails: true,
      log: true,
      timeout: 20000,
    }
  }, function(err, res, body) {
    var thumbnails = []
    body.data.forEach(function(link) {
      if ('website' === link.type) {
        t.assert(link.appId === link.appUrl)
        t.assert(link.validatedDate)
        t.assert(link.photo)
        t.assert(/\.png$/.test(link.photo.prefix), link.photo.prefix)
        thumbnails.push(link.photo.prefix)
      }
    })
    t.assert(thumbnails.length)
    // TODO: get files from s3
    test.done()
  })
}

// Issue 121
exports.timeoutWorksWhenWaitingForContent = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/get',
    body: {
      applinks: [
        {type: 'website', appId: 'http://www.google.com?n=54321'},
      ],
      waitForContent: true,
      testThumbnails: true,
      log: true,
      timeout: 1000,
    }
  }, function(err, res, body) {
    t.assert(0 === body.data.length)
    test.done()
  })
}
