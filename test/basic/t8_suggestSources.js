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

exports.checkTwitter = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: serviceUri + '/test/twitter.html'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1)
    t.assert(res.body.data[0].source === 'twitter')
    t.assert(res.body.data[0].id === 'bob')
    test.done()
  })
}

exports.checkFacebook = function(test) {
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

exports.checkEmail = function(test) {
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

