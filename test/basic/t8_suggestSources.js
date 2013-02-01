/**
 *  Proxibase local suggestSources test
 */

var util = require('util')
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
    var data = res.body.data
    t.assert(data.length === 2)
    t.assert(data[0].source === 'facebook')
    // make a map of the results array by id
    var sources = {}
    data.forEach(function(elem) {
      sources[elem.id] = elem
    })
    t.assert(Object.keys(sources).length === data.length)  // no dupes by id
    t.assert(sources['george.snelling'])
    t.assert(sources['george.snelling'].name === 'George Snelling')
    t.assert(sources['GetLuckyStrike'])
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

_exports.compareFoursquareToFactual = function(test) {
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
      t.assert(sourcesFact.length === sources4s.length)
    })
  })
}
