/**
 *  Patchr perf test utilities
 *
 *  Shared init code for both the android and ios perf tests
 *
 */


var async = require('async')
var assert = require('assert')
var util = require('proxutils')


function setup(db, cb) {

  var out = {}

  var tasks = [
    findPlace,
    findUser,
    findInstall,
  ]

  async.waterfall(tasks, function(err) {
    cb(err, out)
  })

  function findPlace(cb) {
    db.places.find({}).count(function(err, count) {
      if (err) return cb(err)
      assert(count)
      var i = Math.floor(Math.random() * count)
      db.places.safeFind({}, {sort: '_id', limit: 1, skip: i}, function(err, places) {
        if (err) return cb(err)
        assert(places.length === 1)
        out.place = places[0]
        assert(out.place._id && out.place.location)
        out.loc = _.cloneDeep(out.place.location)       // module global
        cb()
      })
    })
  }


  function findUser(cb) {
    db.places.safeFindOne({_id: out.place._id}, {
      asAdmin: true,
      linked: {
        to: 'beacons', type: 'proximity', limit: 1, linked: {
          from: 'patches', type: 'proximity', limit: 1, linked: {
            from: 'users', type: 'create', limit: 1
          }
        }
      }
    }, function(err, savedPlace) {
      if (err) return cb(err)
      assert(savedPlace && savedPlace.linked && savedPlace.linked.length)
      var beacon = savedPlace.linked[0]
      assert(beacon.linked && beacon.linked.length)
      var patch = beacon.linked[0]
      assert(patch.linked && patch.linked.length)
      out.user = patch.linked[0]
      cb()
    })
  }


  function findInstall(cb) {
    db.installs.safeFind({_user: out.user._id}, {asAdmin: true}, function(err, installs) {
      if (err) return cb(err)
      assert(installs && installs.length)
      // users can have more than one install, but we only need one for this test
      out.user.installId = installs[0].installId
      assert(out.user.installId)
      cb()
    })
  }
}


// Helper
function logPerf(body) {
  var nBytes = JSON.stringify(body.data).length * 2
  log('bytes: ' + nBytes + ' time: ' + body.time)
}


exports.setup = setup
exports.logPerf = logPerf
