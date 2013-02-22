/**
 *  Proxibase local suggestSources test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var serviceUri = util.config.service.uri
var t = testUtil.treq  // newfangled test helper
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
  var url = serviceUri + '/test/twitter.html'
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{type: 'website', id: url}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1)
    t.assert(res.body.data[0].type === 'twitter')
    t.assert(res.body.data[0].id === 'bob')
    t.assert(res.body.data[0].name === '@bob')
    t.assert(res.body.data[0].data)
    t.assert(res.body.data[0].data.packageName === 'com.twitter.android')
    t.assert(res.body.data[0].data.icon)
    t.assert(res.body.data[0].data.icon.indexOf('twitter.png') > 0)
    t.assert(res.body.data[0].data.origin === 'website')
    t.assert(res.body.data[0].data.originUrl === url)
    test.done()
  })
}

exports.checkFacebookUrls = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{type: 'website', id: serviceUri + '/test/facebook.html'}]}
  },
  function(err, res) {
    var sources = res.body.data
    t.assert(sources.length === 3)
    // make a map of the results array by id
    var map = {}
    sources.forEach(function(source) {
      t.assert(source.id)
      t.assert(source.type === 'facebook')
      t.assert(source.data)
      t.assert(source.data.origin.indexOf('website') === 0)
      t.assert(source.data.icon)
      t.assert(source.data.packageName)
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
    body: {sources: [{type: 'website', id: serviceUri + '/test/email.html'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1)
    t.assert(res.body.data[0].type === 'email')
    t.assert(res.body.data[0].id === 'george@3meters.com')
    test.done()
  })
}

exports.checkEmailUrlsWithGet = function(test) {
  t.get({uri:'/do/suggestSources?sources[0][type]=website&sources[0][id]=' +
        serviceUri + '/test/email.html'},
  function(err, res) {
    t.assert(res.body.data.length === 1)
    t.assert(res.body.data[0].type === 'email')
    t.assert(res.body.data[0].id === 'george@3meters.com')
    test.done()
  })
}

exports.checkBogusSources = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{type: 'foursquare', url: 'http://www.google.com'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 0)
    test.done()
  })
}


exports.compareFoursquareToFactual = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]}  // Seattle Ballroom
  },
  function(err, res) {
    var sources4s = res.body.data
    t.assert(sources4s.length > 3)
    t.post({
      uri: '/do/suggestSources',
      // Seattle Ballroom
      body: {sources: [{type: 'factual', id: 'a10ad88f-c26c-42bb-99c6-10233f59d2d8'}],
             includeRaw: true}
    }, function(err, res) {
      var sourcesFact = res.body.data
      t.assert(sourcesFact.length > 3)
      t.assert(sourcesFact.length === sources4s.length + 1) // factual will add the 4s entry
      test.done()
    })
  })
}

exports.getFacebookFromFoursquare = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {
      sources: [
        {
          type: 'foursquare',
          id: '42893400f964a5204c231fe3',
          name: 'The Red Door',
        }
      ],
      location: {lat: 47.65, lng: -122.35},
      includeRaw: true
    }
  },
  function(err, res) {
    var sources = res.body.data
    t.assert(sources && sources.length)
    t.assert(sources.some(function(source) {
      return (source.type === 'facebook'
        && source.id === '155509047801321'
        && source.data
        && source.data.origin === 'facebook')
    }))
    test.done()
  })
}
