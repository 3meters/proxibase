/*
 *  Proxibase suggest api tests
 *
 *     These tests are not stubbed, but make internet calls based on random 
 *     web pages and services existing on the web.  Fine to move out of basic once
 *     feature area is stable.  
 */

var util = require('util')
var log = util.log
var testUtil = require('../util')
var t = testUtil.T()  // newfangled test helper
var userCred
var adminCred
var testLatitude = 46.1
var testLongitude = -121.1
var testEntity = {
      photo: {
        prefix: "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
        format: "binary",
        sourceName: "aircandi",
      },
      signalFence : -100,
      name : "Test Place Entity Suggest Sources",
      type : "com.aircandi.candi.place",
      place: {location:{lat:testLatitude, lng:testLongitude}},
      visibility : "public",
      isCollection: true,
      enabled : true,
      locked : false,
    }
var _exports = {} // for commenting out tests


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.suggestSourcesFromWebsite = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: 'http://www.massenamodern.com'}]}
  },
  function(err, res) {
    t.assert(res.body.sources.length === 1) // returns only the new suggested sources
    t.assert(res.body.sources[0].source === 'twitter')
    t.assert(res.body.sources[0].id === '@massenamodern')
    test.done()
  })
}

exports.suggestFactualSourcesFromFoursquareId = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'foursquare', id: '4abebc45f964a520a18f20e3'}]} // Seattle Ballroom in Fremont
  },
  function(err, res) {
    t.assert(res.body.sources.length > 10)
    // Check no dupe of original source
    res.body.sources.forEach(function(source) {
      t.assert(!(source.source == 'foursquare' && source.id == '4abebc45f964a520a18f20e3'))
    })
    test.done()
  })
}

exports.insertEntitySuggestSources = function(test) {
  var body = {
    suggestSources: true,
    entity: util.clone(testEntity),
  }
  body.entity.sources = [{
    source: 'website',
    id: 'http://www.massenamodern.com'
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(res.body.data.sources)
      var sources = res.body.data.sources
      t.assert(sources.length === 2) // appends the new sources to the ones in the request
      t.assert(sources[1].source === 'twitter')
      t.assert(sources[1].id === '@massenamodern')
      test.done()
    }
  )
}

exports.insertPlaceEntitySuggestSourcesFromFactual = function(test) {
  var body = {
    suggestSources: true,
    entity: util.clone(testEntity),
  }
  body.entity.sources = [{
    source: 'foursquare',
    id: '4abebc45f964a520a18f20e3' // Seattle Ballroom 
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(res.body.data.sources)
      var sources = res.body.data.sources
      t.assert(sources.length > 10) // appends the new sources to the ones in the request
      // TODO: check for specific source
      // TODO: add website to sources and then check for dupes
      test.done()
    }
  )
}
