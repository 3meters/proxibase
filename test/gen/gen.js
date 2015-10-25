/**
 *  Patchr gendata test
 *
 *  This tests aims to generate a lot of data that closely
 *  simulates real world data.
 *
 *  To run stand-alone:  cd test, node test -t gen
 *  The database can then be used to run the perf tests
 *
 *  Not safe to run concurrently.
 *
 *  Goes through the public apis, not directly to
 *  the db.  Posts are chunked in batches which is
 *  not realistic but makes it run much faster
 *
 */


var async = require('async')
var qs = require('querystring')
var util = require('proxutils')
var seed = util.seed(8)  // for running tests concurrently
var seed2 = util.seed(8)
var testUtil = require('../util')
var skip = testUtil.skip
var t = testUtil.treq
var testUserId
var db = testUtil.safeDb   // raw mongodb connection object without mongoSafe wrapper
var assert = require('assert')
var admin = {}
var photo = {
  prefix: 'picture.jpg',
  source: 'aircandi.users'
}
var _exports = {}  // For commenting out tests


// These decide who big the db will be
var nUsers = 10
var nBeaconsPerPlace = 10
var nPatchesPerUser = 50
var nMessagesPerPatchPerUser = 20


// We chunk some bulk inserts to stay under the post body limit of the server
// Lower this number if the server fails with a body too big error
var nMaxDocsPerPost = 100

// Generate a random location on earth based on seeds 1 and 2
// This is so that the test can be run concurrently and not
// have the generated patches land on top of each other
var base = Math.pow(10,8) // second param should be the same as the seed precision
var lat = ((Number(seed) % 179) - 89) + (Number(seed2) / base)
var lng = ((Number(seed2) % 359) - 179) + (Number(seed) / base)
var distance = 0.0001 // distance between patches in lat / lng increments, should be 100 meters or so
var midpoint = {lat: lat + (distance * nPatchesPerUser / 2), lng: lng + (distance * nPatchesPerUser / 2)}

var _users = []
var _places = []
var _beacons = []

// Create the users array
for (var i = 0; i < nUsers; i++) {
  _users.push({
    name: 'User ' + seed + '.' + i,
    email: 'user' + seed + '.' + i + '@3meters.com',
    password: '123456',
    photo: photo,
  })
}

// Create the places and beacons arrays
// One place for each patch per user, strung
// out in a line about 100 meters apart
for (var i = 0; i < nPatchesPerUser; i++) {

  var nudge = i * distance
  var loc = {lat: lat + nudge, lng: lng + nudge}
  var _place = 'pl.place.' + seed + '.' + i
  var place = {_id: _place, name: 'place.' + seed, location: loc, photo: photo, links: []}

  // Add the beacons for this place to the beacons array
  for (var ib = 0; ib < nBeaconsPerPlace; ib++) {
    var bssid = 'beacon.' + seed + '.' + i + '.' + ib
    var beacon = {_id: 'be.' + bssid, bssid: bssid, location: loc}
    _beacons.push(beacon)
    place.links.push({_to: beacon._id, type: 'proximity'})
  }

  // Now add the place with its links to the _places array
  _places.push(place)
}


// Utility function to post an array of documents to a uri in chunks of
// size nMaxDocsPerPost.
// We still need to be able to hold 2 full copies of the array in memory
// on the machine running the test,
// So it won't handle huge amounts like a stream, but it will allow posting
// much larger arrays than are allowed in our default post max size
function postChunked(uri, docs, cb) {

  var results = []
  var chunks = [[]]  // array of arrays with first array initialized
  var iChunk = 0
  var iDocInChunk = 0

  // Map the array of docs into a nested array of chunks of docs
  docs.forEach(function(doc) {
    if (iDocInChunk >= nMaxDocsPerPost) {  // create a new chunk
      iChunk++
      chunks[iChunk] = []
      iDocInChunk = 0
    }
    chunks[iChunk].push(doc)
    iDocInChunk++
  })

  log('Posting to', uri)
  async.eachSeries(chunks, postChunk, function (err) { cb(err, results) })

  // post the chunk of docs then append the saved docs to the results
  function postChunk(chunk, nextChunk) {
    var timer = util.timer()
    t.post({uri: uri, body: {data: chunk}}, 201, function(err, res, body) {
      t.assert(body.data && body.data.length === chunk.length)
      log(chunk.length + ' docs posted in ' + Math.round(timer.read() / chunk.length) + 'ms per doc')
      body.data.forEach(function(doc) { results.push(doc) })
      nextChunk()
    })
  }
}


//
// Begin Tests
//
exports.getAdminSession = function(test) {
  testUtil.getAdminSession(function(session) {
    admin._id = session._owner
    admin.cred = 'user=' + session._owner +
        '&session=' + session.key + '&install=' + seed
    test.done()
  })
}



exports.createUsers = function(test) {

  async.eachSeries(_users, createUser, finish)

  function createUser(user, next) {
    t.post({
      uri: '/user/create',
      body: {
        data: user,
        secret: 'larissa',
        installId: util.seed(8),  // Random 8-digit number as a string
      },
    }, function(err, res, body) {
      if (!(body.user && body.credentials)) throw new Error(util.inspect(body))
      // Add saved properties to global user array
      _.extend(user, body.user)
      user.credentials = body.credentials
      // cache a query string of the credentials for sending gets
      user.cred = qs.stringify(body.credentials)
      next()
    })
  }

  function finish(err) {
    if (err) throw err
    _users.forEach(function(user) {
      if (!(user._id && user.role && user.cred)) {
        throw new Error('Save failed: ' + util.inspect(_users))
      }
    })
    test.done()
  }
}


exports.registerInstalls = function(test) {

  var _install = {
    clientVersionCode: 80,
    clientVersionName: '1.0.0',
    deviceType: 'ios',
    deviceVersionName: '8.0.0',
    locationDate: util.now(),
  }

  async.eachSeries(_users, registerInstall, finish)

  function registerInstall(user, next) {

    var install = _.extend({
      _user: user._id,
      installId: user.credentials.install,
      parseInstallId: user._id + '.' + user.credentials.install,
      location: midpoint,
    }, _install)

    t.post({
      uri: '/do/registerInstall?' + user.cred,
      body: {install: install},
    }, function(err, res, body) {
      next()
    })
  }

  function finish(err) {
    if (err) throw err
    test.done()
  }
}


exports.postBeacons = function(test) {
  var uri = '/data/beacons?' + _users[0].cred
  postChunked(uri, _beacons, function (err, saved) {
    if (err) throw err
    if (!saved.length) throw 'Save failed'
    test.done()
  })
}


exports.postPlaces = function(test) {
  var nLinks = 0
  var uri = '/data/places?' + admin.cred
  postChunked(uri, _places, function(err, saved) {
    if (err) throw err
    if (!saved.length) throw 'Save failed'
    saved.forEach(function(place) {
      if (place.links) nLinks += place.links.length
    })
    test.done()
  })
}

exports.usersCreatePatches = function(test) {
  var users = _.cloneDeep(_users)
  var nPatchesSaved = 0
  var nLinksSaved = 0

  async.eachSeries(_users, postPatchesForUser, finish)

  function postPatchesForUser(user, nextUser) {

    var iPlace = 0
    async.eachSeries(_places, postPatchToPlace, nextUser)

    function postPatchToPlace(place, nextPlace) {
      var patch = {
        name:   user.name + ' patch ' + seed + '.' + iPlace,
        links:  [{_to: place._id, type: 'proximity'}],
      }
      // Each place already has a number of becons linked to it by proximity
      // Create direct links between this patch and those beacons
      var nPlaceProxLinks = 0
      place.links.forEach(function(placeLink) {
        if (placeLink.type === 'proximity') {
          nPlaceProxLinks++
          patch.links.push({_to: placeLink._to, type: placeLink.type})
        }
      })

      t.post({
        uri: '/data/patches?' + user.cred,
        body: {data: patch},
      }, 201, function(err, res, body) {
        t.assert(body.data && body.data.links)
        t.assert(body.data.links.length === (nPlaceProxLinks + 2))
        nPatchesSaved++
        nLinksSaved += body.data.links.length
        iPlace++
        nextPlace()
      })
    }
  }

  function finish (err) {
    if (err) throw err
    test.done()
  }
}

exports.usersWatchPatches = function(test) {
  var nWatchLinks = 0
  async.eachSeries(_users, watchAllPatches, finish)

  function watchAllPatches(user, nextUser) {
    var others = []
    _users.forEach(function(other) {
      if (other._id !== user._id) others.push({_id: other._id})
    })
    async.eachSeries(others, watchAnothersPatches, nextUser)

    function watchAnothersPatches(other, nextOther) {
      var timer = util.timer()
      var uri = '/find/patches?qry[_owner]=' + other._id + '&limit=1000&' + user.cred
      t.get(uri, function(err, res, body) {
        t.assert(body.data && body.data.length)
        async.eachSeries(body.data, watch, function(err) {
          t.assert(!err)
          log('Watched ' + body.data.length + ' patches in ' + Math.round(timer.read()/body.data.length) + 'ms per patch')
          nextOther()
        })
        function watch(patch, nextPatch) {
          t.post({
            uri: '/data/links?' + user.cred,
            body: {data: {_to: patch._id, _from: user._id, type: 'watch'}},
          }, 201, function(err, res, body) {
            t.assert(body.data)
            t.assert(body.data.enabled)
            nWatchLinks++
            nextPatch()
          })
        }
      })
    }
  }

  function finish (err) {
    t.assert(!err)
    if (!nWatchLinks) throw 'Save failed'
    test.done()
  }
}

exports.makeHalfThePatchesPrivate = function(test) {

  var i = 0
  var nSkipped = 0
  var userMap = {}
  _users.forEach(function(user) {
    userMap[user._id] = user
  })

  async.forever(function(next) {
    var uri = '/find/patches?sort=_id&limit=1&skip=' + i
    t.get(uri, function(err, res, body) {
      if (err) return finish(err)
      t.assert(body.data && tipe.isArray(body.data))
      var patch = body.data[0]
      if (!patch) return finish()  // all done
      t.assert(patch._id && patch._owner)
      var owner = userMap[patch._owner]
      if (!owner) {  // Patchr tips and tricks autogenerated patch
        i++
        nSkipped++
        return next()
      }
      t.post({
        uri: '/data/patches/' + patch._id + '?' + owner.cred,
        body: {data: {visibility: 'private'}}
      }, function(err, res, body) {
        if (err) return finish(err)
        t.assert(body.data && body.data.visibility === 'private')
        i+= 2  // skip half the patches
        next()
      })
    })
  })

  function finish(err) {
    if (err) throw err
    test.done()
  }
}


exports.usersCreateMessages = function(test) {

  async.eachSeries(_users, addMessagesForUser, finish)

  function addMessagesForUser(user, nextUser) {

    t.get('/data/patches?qry[_owner]=' + user._id + '&' + user.cred,
    function(err, res, body) {
      var patches = body.data
      t.assert(patches && patches.length)

      var iPatch = 0
      async.eachSeries(patches, addMessagesForPatch, nextUser)

      function addMessagesForPatch(patch, nextPatch) {

        // Build the messages for this user to send to this patch
        var messages = []
        for (var i = 0; i < nMessagesPerPatchPerUser; i++) {
          var msg = {
            description: user.name + ' message ' + i + ' to patch ' + iPatch,
            photo: photo,
            links: [{_to: patch._id, type: 'content'}]
          }
          messages.push(msg)
        }

        var uri = '/data/messages?' + user.cred
        postChunked(uri, messages, function(err, saved) {
          if (err) return finish(err)
          iPatch++
          nextPatch()
        })
      }
    })
  }

  function finish(err) {
    t.assert(!err)
    test.done()
  }
}

exports.buildLinkStats = function(test) {
  t.get('/stats/rebuild?' + admin.cred,
  function(err, res, body) {
    t.assert(body)
    t.assert(body.to)
    t.assert(body.to.cmd)
    t.assert(body.to.results)
    t.assert(body.from)
    t.assert(body.from.cmd)
    t.assert(body.from.results)
    test.done()
  })
}
