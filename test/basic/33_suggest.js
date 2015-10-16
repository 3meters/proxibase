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

var savedPlace = null

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

// Place suggest query
var luckyPlaceQuery = {
  provider: 'google',
  location: luckyStrikeLoc,
  input: 'lucky',
  sensor: true,
  limit: 10,
  log: true,
}

exports.suggestPlacesGoogle = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/suggest/places?' + userCred,
    body: luckyPlaceQuery,
  }, function(err, res, body) {
    var foundPlace = null
    var places = body.data
    t.assert(places && places.length)
    t.assert(places.length <= 5) // 4 if lucky is in db and 5 otherwise
    var hitCount = 0
    places.forEach(function(place) {
      if (0 === place.name.indexOf('Lucky Strike')) {
        foundPlace = place
        return
      }
    })
    t.assert(foundPlace)
    t.assert(!foundPlace._id)        // Does not exist in our database yet
    t.assert(foundPlace.synthetic)   // same
    // Delete properties returned from suggest that are not saved to our db by the client
    delete foundPlace.reason
    delete foundPlace.score
    delete foundPlace.synthetic
    t.post({
      uri: '/data/places?' + userCred,
      body: {data: foundPlace}
    }, 201, function(err, res, body) {
      t.assert(body.count === 1)
      t.assert(body.data._id)
      savedPlace = body.data
      test.done()
    })
  })
}


// TODO:  Run the same suggest query again.  We should get back the place that we
// inserted in the db.  It should alreay have an _id, but otherwise it should look
// just like found place
exports.suggestPlaceGoogleAgain = function(test) {

  if (disconnected) return skip(test)

  t.post({
    uri: '/suggest/places?' + userCred,
    body: luckyPlaceQuery,
  }, function(err, res, body) {
    var foundPlace = null
    var places = body.data
    t.assert(places && places.length)
    t.assert(places.length >= 5) // 4 if lucky is in db and 5 otherwise
    var hitCount = 0
    places.forEach(function(place) {
      if (0 === place.name.indexOf('Lucky Strike')) {
        foundPlace = place
        return
      }
    })
    // Since we cached the place in our db on the last query
    // subsequent calls should return our cached copy, not googles copy
    t.assert(foundPlace._id === savedPlace._id)
    test.done()
  })
}


exports.suggestPatchesFts = function(test) {

  if (disconnected) return skip(test)

  t.get('/suggest/patches?input=patch 33&regex=0',  // turn off regex search
  function(err, res, body) {
    t.assert(body.data.length === 1)
    t.assert(body.data[0].name.indexOf('Test Patch 33') === 0)
    test.done()
  })
}


exports.suggestUsersRegex = function(test) {

  t.get('/suggest/users?input=use&fts=0&ll=47,-122',  // match beginning of second word in name
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


// TODO:  There is a timing problem here that fails intermitently
exports.suggestCombined = function(test) {

  if (disconnected) return skip(test)

  t.get('/suggest?users=1&patches=true&input=t&limit=50',
  function(err, res, body) {
    t.assert(body.data.length)
    var cUsers = 0
    var cPatches = 0
    var lastScore = Infinity
    body.data.forEach(function(ent) {
      t.assert(ent.score >= 1)
      t.assert(ent.score <= 20)
      t.assert(lastScore >= ent.score)
      lastScore = ent.score
      if ('user' === ent.schema) cUsers++
      if ('patch' === ent.schema) cPatches++
    })
    t.assert(cUsers)
    t.assert(cPatches)
    t.assert(cUsers + cPatches === body.data.length)
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

exports.suggestPlaceResidence = function(test) {

  if (disconnected) return skip(test)

  t.get('/suggest/places?provider=google&fts=-1&regex=-1&input="312 N 49th St, 98103"',
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length === 1)
    var place = body.data[0]
    t.assert(place.provider.google)
    t.assert(place.provider.googleRef)
    t.assert(place.name === "312 N 49th St")
    test.done()
  })
}
