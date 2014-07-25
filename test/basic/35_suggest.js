/**
 *  Suggest tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var dbProfile = testUtil.dbProfile
var skip = testUtil.skip
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests

var LuckyStrikeId = ''
var luckyStrikeLoc = {
  lat: 47.616658,
  lng: -122.201373,
}

// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.suggestPlacesFoursquare = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/suggest/places?' + userCred,
    body: {
      provider: 'foursquare',
      location: luckyStrikeLoc,
      input: 'lucky',
      timeout: 15000,
      limit: 10,
      log: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length > 5)
    var hitCount = 0
    places.forEach(function(place){
      if (0 === place.name.indexOf('Lucky Strike')) hitCount++
    })
    t.assert(hitCount >= 1)
    test.done()
  })
}

exports.suggestPlacesGoogle = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/suggest/places?' + userCred,
    body: {
      provider: 'google',
      location: luckyStrikeLoc,
      input: 'lucky',
      sensor: true,
      limit: 10,
      log: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(places && places.length <= 5) // 4 if lucky is in db and 5 otherwise
    var hitCount = 0
    places.forEach(function(place){
      t.assert(place.score)
      if (0 === place.name.indexOf('Lucky Strike')) hitCount++
    })
    t.assert(1 === hitCount)
    test.done()
  })
}


// Populate our db using a near query, then test our built-in suggest provider
// in following tests
exports.getPlacesNear = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/places/near?' + userCred,
    body: {
      location: luckyStrikeLoc,
      limit: 50,
      refresh: true,
      // radius: 500,
      // log: true,
    }
  }, 200, function(err, res, body) {
    var places = body.data
    t.assert(50 === places.length)

    var lastDistance = 0
    places.forEach(function(place) {
      t.assert(place.location)
      // places should be sorted by distance from original location, close enough is ok
      var distance = util.haversine(luckyStrikeLoc.lat, luckyStrikeLoc.lng,
        place.location.lat, place.location.lng)
      /*
      log(distance + ' ' + place.name + ' ' + Object.keys(place.provider).join(' ') +
        ' ' + place.location.lat + ' ' + place.location.lng + ' ' + place.location.accuracy)
      */
      if (place.location.accuracy < 100) {
        t.assert((distance >= lastDistance || ((distance - lastDistance) < lastDistance / 2)),
            {distance: distance, lastDistance: lastDistance, place: place})
        lastDistance = distance
      }
    })

    t.assert(places.some(function(place) {
      return place.name.match(/^McCormick/)
    }))

    test.done()
  })
}

exports.suggestPlaceRegex = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/suggest/places?' + userCred,
    body: {
      location: luckyStrikeLoc,
      input: 'schmi',                         // initial exact match of third word in name
      fts: false,                             // turn off full text search
      limit: 10,
    }
  }, 200, function(err, res, body) {
    t.assert(body.data.length === 1)
    t.assert(body.data[0].name.indexOf('McCormick') === 0)
    test.done()
  })
}

exports.suggestPlacesFts = function(test) {

  if (disconnected) return skip(test)

  t.get('/suggest/places?input=lucky&ll=47.616658,-122.201373&regex=0',  // turn off regex search
  function(err, res, body) {
    t.assert(body.data.length === 1)
    t.assert(body.data[0].name.indexOf('Lucky') === 0)
    test.done()
  })
}

exports.suggestUsersRegex = function(test) {

  // add a bogus ll param that should be ignored, fix issue 259
  t.get('/suggest/users?input=use&fts=0&ll=47-122',  // match beginning of second word in name
  function(err, res, body) {
    t.assert(body.data.length >= dbProfile.users)
    body.data.forEach(function(user) {
      t.assert(user.score >= 1)
      t.assert(user.score <= 20)
      t.assert(user.name.indexOf('Test User' === 0))
    })
    test.done()
  })
}

exports.suggestUsersFts = function(test) {

  t.get('/suggest/users?input=testville&regex=0',  // testville is in user.area of default users
  function(err, res, body) {
    t.assert(body.data.length >= dbProfile.users)
    body.data.forEach(function(user) {
      t.assert(user.score >= 1)
      t.assert(user.score <= 20)
      t.assert(user.name.indexOf('Test User' === 0))
      t.assert(user.area.indexOf('Testville') === 0)
    })
    test.done()
  })
}


exports.suggestCombined = function(test) {

  if (disconnected) return skip(test)

  t.get('/suggest?input=t&limit=50',
  function(err, res, body) {
    t.assert(body.data.length)
    var cUsers = 0
    var cPlaces = 0
    var lastScore = Infinity
    body.data.forEach(function(ent) {
      t.assert(ent.score >= 1)
      t.assert(ent.score <= 20)
      t.assert(lastScore >= ent.score)
      lastScore = ent.score
      if ('user' === ent.schema) cUsers++
      if ('place' === ent.schema) cPlaces++
    })
    t.assert(cUsers)
    t.assert(cPlaces)
    t.assert(cUsers + cPlaces === body.data.length)
    test.done()
  })
}


exports.suggestWatchedEntitiesSortFirst = function(test) {
  // Find default test user 3 and watch him
  t.get('/data/users?query[name]=Test User 3',
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === 1)
    var user3Id = body.data[0]._id
    t.post({
      uri: '/data/links?' + userCred,
      body: {data: {
        _to: user3Id,
        _from: user._id,
        type: 'watch',
      }},
    }, 201, function(err, res, body) {
      t.get('/suggest/users?input=test&' + userCred,
      function(err, res, body) {
        t.assert(body.data.length >= dbProfile.users)
        t.assert(body.data[0]._id === user3Id)
        t.assert(body.data[0].score > 10)
        test.done()
      })
    })
  })
}
