/*
 *  Proxibase external service provider tests
 *
 *     These tests are not stubbed, but make internet calls based on random 
 *     web pages and services existing on the web.  Fine to move out of basic once
 *     feature area is stable.
 */

var util = require('proxutils')
var _ = util._
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq  // newfangled test helper
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
  var ballRoomId = '4abebc45f964a520a18f20e3'
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'foursquare',
      meters: 100,
      includeRaw: false,
      limit: 10,
      excludePlaceIds: [ballRoomId], // The Ballroom's 4sId
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 9) // arguably a bug, the exclude process happens after the query
    places.forEach(function(place) {
      t.assert(place._id)
      t.assert(place._id !== ballRoomId)
      t.assert(place.place)
      t.assert(place.place.category)
      t.assert(place.place.category.name)
      var sources = place.sources
      t.assert(sources)
      t.assert(sources.length)
      sources.forEach(function(source) {
        t.assert(source.type)
        t.assert(source.id || source.url)
        t.assert(source.icon)
      })
    })
    test.done()
  })
}

exports.getPlacesNearLocationFactual = function(test) {
  // var ballRoomId = 'a10ad88f-c26c-42bb-99c6-10233f59d2d8'
  var ballRoomId = '46aef19f-2990-43d5-a9e3-11b78060150c'
  var roxyId = 'fdf4b14d-93d7-4ada-8bef-19add2fa9b15' // Roxy's Diner
  var foundRoxy = false
  t.post({
    uri: '/do/getPlacesNearLocation',
    body: {
      latitude: 47.6521,
      longitude: -122.3530,   // The Ballroom, Fremont, Seattle
      provider: 'factual',
      meters: 100,
      limit: 10,
      excludePlaceIds: [ballRoomId],
      includeRaw: true,
    }
  }, function(err, res) {
    var places = res.body.data
    t.assert(places.length === 9)
    places.forEach(function(place) {
      t.assert(place._id)
      t.assert(place._id !== ballRoomId)
      t.assert(place.place)
      t.assert(place.place.category)
      t.assert(place.place.category.name)
    })
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
        t.assert(source.type)
        if (source.type === 'factual') t.assert(source.hidden)
        t.assert(source.id || source.url)
        if (!source.hidden) t.assert(source.icon)
        t.assert(source.data)
        t.assert(source.data.origin)
      })
      test.done()
    })
  }
}


exports.suggestSourcesFromWebsite = function(test) {
  t.post({
    uri: '/sources/suggest',
    body: {sources: [{type: 'website', id: 'http://www.massenamodern.com'}]}
  },
  function(err, res) {
    t.assert(res.body.data.length === 2)
    t.assert(res.body.data[1].type === 'twitter')
    t.assert(res.body.data[1].id === 'massenamodern')
    test.done()
  })
}


exports.suggestFactualSourcesFromFoursquareId = function(test) {
  t.post({
    uri: '/sources/suggest',
    body: {sources: [{type: 'foursquare', id: '4abebc45f964a520a18f20e3'}]} // Seattle Ballroom in Fremont
  },
  function(err, res) {
    t.assert(res.body.data.length > 3)
    var source = res.body.data[0]
    t.assert(source.type === 'foursquare' && source.id === '4abebc45f964a520a18f20e3')
    test.done()
  })
}

exports.insertEntitySuggestSources = function(test) {
  var body = {
    suggestSources: true,
    entity: _.clone(testEntity),
  }
  body.entity.sources = [{
    type: 'website',
    id: 'http://www.massenamodern.com'
  }]
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(res.body.data[0].sources)
      var sources = res.body.data[0].sources
      t.assert(sources.length === 2) // appends the new sources to the ones in the request
      t.assert(sources[1].type === 'twitter')
      t.assert(sources[1].id === 'massenamodern')
      test.done()
    }
  )
}

exports.insertPlaceEntitySuggestSourcesFromFactual = function(test) {
  var body = {
    suggestSources: true,
    entity: _.clone(testEntity),
  }
  body.entity.sources = [{
    type: 'foursquare',
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

exports.getPlacePhotos = function(test) {
  t.post({
    uri: '/do/getPlacePhotos',
    body: {provider: 'foursquare', id: '4abebc45f964a520a18f20e3'}
  }, function(err, res, body) {
    t.assert(body.data.length > 10)
    test.done()
  })
}
