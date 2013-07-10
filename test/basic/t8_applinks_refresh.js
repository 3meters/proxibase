/**
 *  Proxibase applink refresh test
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


exports.refreshApplinksFailsProperlyOnBogusWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/refresh',
    body: {
      applinks: [{type: 'website', appUrl: 'www.iamabogusurlhaha.com'}]
    }
  }, function(err, res, body) {
    t.assert(0 === body.data.length)
    test.done()
  })
}

exports.refreshApplinksWorksOnWebsite = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/refresh',
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

exports.refreshFoursquareApplinkDoesNotSuggest = function(test) {
  if (disconnected) return skip(test)
  var started = util.now()
  t.post({
    uri: '/applinks/refresh',
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
    t.assert(1 === body.data.length) // proves we did not run suggest
    var result = body.data[0]
    // we overwrite user photos with provider photos on refresh
    t.assert(result.photo)
    t.assert('http://www.myimage.com/foo.jpeg' !== result.photo.prefix)
    t.assert('foursquare' === result.photo.source)
    t.assert(result.data)
    t.assert(started <= result.data.validated)
    test.done()
  })
}

exports.appLinkPositionSortWorks = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/applinks/refresh',
    body: {
      applinks: [
        {type: 'facebook', appId: '155509047801321'},
        {type: 'website', position: 1, appId: 'www.reddoorseattle.com'},
        {type: 'yelp', position: 0, appId: 'q20FkqFbmdOhfSEhaT5IHg'},
        {type: 'foursquare', appId: '42893400f964a5204c231fe3'},
      ]
    }
  }, function(err, res, body) {
    t.assert(body.data)
    t.assert(4 === body.data.length)
    t.assert('yelp' === body.data[0].type)
    t.assert(body.data[0].position === 0)
    t.assert('website' === body.data[1].type)
    t.assert(body.data[1].data)
    t.assert(body.data[1].data.validated)
    t.assert(body.data[1].position === 1)
    t.assert('foursquare' === body.data[2].type)
    t.assert(body.data[2].data)
    t.assert(body.data[2].data.validated)
    t.assert(!body.data[2].position)
    t.assert('facebook' === body.data[3].type)
    t.assert(body.data[3].data)
    t.assert(body.data[3].data.validated)
    t.assert(!body.data[3].position)
    test.done()
  })
}
