/*
 *  Proxibase external service provider tests
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
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

exports.getCategories = function(test) {
  t.get({uri: '/categories'}, function(err, res) {
    var cats = res.body.data
    t.assert(cats && cats.length > 5)
    t.assert(cats[0].icon.length > 20)
    // TODO:  run a reqest on the icon and confirm that it is a valid png
    test.done()
  })
}

exports.getSources = function(test) {
  t.get({uri: '/sources'}, function(err, res) {
    var sources = res.body.data
    t.assert(sources && sources.length > 5)
    t.assert(sources[0].icon.length > 20)
    // TODO:  run a reqest on the icon and confirm that it is a valid png
    test.done()
  })
}

exports.getPlacesNearLocationFoursquare = function(test) {
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      source: 'foursquare',
      meters: 100,
      includeRaw: false,
      limit: 10,
    }
  }, function(err, res) {
    var places = res.body.data
    // log('foursquare', places)
    t.assert(places.length === 10)
    t.assert(places[0].place)
    t.assert(places[0].place.category)
    t.assert(places[0].place.category.name)
    var sources = places[0].sources
    t.assert(sources)
    t.assert(sources.length)
    var source = sources[0]
    t.assert(source.source && source.icon && (source.url || source.id))
    test.done()
  })
}

exports.getPlacesNearLocationFactual = function(test) {
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      source: 'factual',
      meters: 100,
      includeRaw: false,
      limit: 10,
    }
  }, function(err, res) {
    var places = res.body.data
    // log('factual', places)
    t.assert(places.length === 10)
    t.assert(places[0].place)
    t.assert(places[0].place.category)
    t.assert(places[0].place.category.name)
    var roxys = places.filter(function(e) {
      return (e._id === 'fdf4b14d-93d7-4ada-8bef-19add2fa9b15') // Roxy's Diner
    })
    t.assert(roxys.length === 1)
    insertEnt(roxys[0])
  })

  // Insert the roxy diner and make sure her sources come out right
  function insertEnt(roxy) {
    var ent = {
      signalFence : -100,
      name : roxy.name,
      type : "com.aircandi.candi.place",
      place: {location:{lat:roxy.place.location.lat, lng:roxy.place.location.lng}},
      sources: roxy.sources,
      visibility : "public",
      isCollection: true,
      enabled : true,
      locked : false,
    }
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: ent,
        suggestSources: true
      }
    }, 201, function(err, res) {
      t.assert(res.body.data.length)
      var sources = res.body.data[0].sources
      t.assert(sources && sources.length >= 2) // a website and a twitter account
      sources.forEach(function(source) {
        t.assert(source.id || source.url)
        t.assert(source.origin && source.icon && source.name && source.source)
        t.assert(source.source !== 'factual')
      })
      test.done()
    })
  }
}


// TODO: test excludePlaceIds

exports.suggestSourcesFromWebsite = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'website', id: 'http://www.massenamodern.com'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 1) // returns only the new suggested sources
    t.assert(res.body.data[0].source === 'twitter')
    t.assert(res.body.data[0].id === 'massenamodern')
    test.done()
  })
}


exports.suggestFactualSourcesFromFoursquareId = function(test) {
  t.post({
    uri: '/do/suggestSources',
    body: {sources: [{source: 'foursquare', id: '4abebc45f964a520a18f20e3'}]} // Seattle Ballroom in Fremont
  },
  function(err, res) {
    t.assert(res.body.data.length > 3)
    // Check no dupe of original source
    res.body.data.forEach(function(source) {
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
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length === 2) // appends the new sources to the ones in the request
      t.assert(sources[1].source === 'twitter')
      t.assert(sources[1].id === 'massenamodern')
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
    function(err, res) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length > 3) // appends the new sources to the ones in the request
      // TODO: check for specific source
      test.done()
    }
  )
}
