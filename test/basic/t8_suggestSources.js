/**
 *  Proxibase local suggestSources test
 */

var util = require('utils')
var log = util.log
var testUtil = require('../util')
var serviceUri = util.config.service.uri
var t = testUtil.T()  // newfangled test helper
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

exports.checkTwitterUrls = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: serviceUri + '/test/twitter.html'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1)
    t.assert(res.body.data[0].source === 'twitter')
    t.assert(res.body.data[0].id === 'bob')
    t.assert(res.body.data[0].name === '@bob')
    t.assert(res.body.data[0].packageName === 'com.twitter.android')
    t.assert(res.body.data[0].icon.indexOf('twitter.png') > 0)
    test.done()
  })
}

exports.checkFacebookUrls = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: serviceUri + '/test/facebook.html'}]}
  },
  function(err, res) {
    var sources = res.body.data
    t.assert(sources.length === 3)
    // make a map of the results array by id
    var map = {}
    sources.forEach(function(source) {
      t.assert(source.id)
      t.assert(source.source === 'facebook')
      t.assert(source.origin === 'website')
      t.assert(source.icon)
      t.assert(source.packageName)
      map[source.id] = source
    })
    t.assert(Object.keys(map).length === sources.length)  // no dupes by id
    t.assert(map['george.snelling'])
    t.assert(map['george.snelling'].name === 'George Snelling')
    t.assert(map['GetLuckyStrike'])
    t.assert(map['papamurphyspizza'])
    test.done()
  })
}

exports.checkEmailUrls = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: serviceUri + '/test/email.html'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1) // returns only the new suggested sources
    t.assert(res.body.data[0].source === 'email')
    t.assert(res.body.data[0].id === 'george@3meters.com')
    test.done()
  })
}


exports.checkBogusSources = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'foursquare', url: 'http://www.google.com'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 0)
    test.done()
  })
}


exports.compareFoursquareToFactual = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'foursquare', id: '4abebc45f964a520a18f20e3'}]}  // Seattle Ballroom
  },
  function(err, res) {
    var sources4s = res.body.data
    t.assert(sources4s.length > 3)
    t.post({
      uri: '/do/suggestSources',
      body: {sources: [{source: 'factual', id: 'a10ad88f-c26c-42bb-99c6-10233f59d2d8'}]}  // Seattle Ballroom
    }, function(err, res) {
      var sourcesFact = res.body.data
      t.assert(sourcesFact.length > 3)
      t.assert(sourcesFact.length === sources4s.length + 1) // factual will add the 4s entry
      test.done()
    })
  })
}
