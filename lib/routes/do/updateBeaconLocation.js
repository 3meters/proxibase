/**
 * updateBeaconLocation
 */

var db = util.db,
    async = require('async'),
    methods = require('./methods')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    beaconIds:      { type: 'array', required: true },
    beaconSignals:  { type: 'array', required: true },
    location:       { type: 'object', required: true },
  }

  /* Request body template end =========================================*/

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (req.body.beaconSignals.length !== req.body.beaconIds.length) {
    return res.error(proxErr.badValue('beaconSignals.length should equal beaconIds.length'))
  }

  run(req, util.clone(req.body)
    , function(err, beaconsUpdated) {
      if (err) return res.error(err)
      res.send({
        data: beaconsUpdated,
        date: util.getTimeUTC(),
        count: beaconsUpdated.length,
        more: false
      })      
  })
}

var run = exports.run = function(req, options, cb) {

  var beacons = []
  var beaconsUpdated = []
  var beaconIds = options.beaconIds
  var beaconSignals = options.beaconSignals
  var location = options.location
  var activityDate = util.getTimeUTC()

  getBeacons()

  function getBeacons() {
    var query = { _id: { $in: beaconIds }, enabled: true }
    db.entities.find(query).toArray(function(err, docs) {
      if (err) return finish(err)

      if (docs.length === 0) finish()
      beacons = docs
      updateBeaconLocation()
    })
  }

  function updateBeaconLocation() {
    /*
     * Beacons can move so when we have a good location fix, we check the 
     * beacon locatio to see if it can be improved with the new fix.
     */
    async.forEach(beacons, evaluateBeacon, finish) 

    function evaluateBeacon(beacon, next) {
      /*
       * We want to find beacons that have moved or are missing
       * location data and need to have their location info updated.
       */
      var updateLocation = false
      var updateReason = 'unknown'
      var signal
      /*
       * If the caller can provide a beacon, they should be able
       * to provide the signal level.
       */
      for (var j = beaconIds.length; j--;) {
        if (beaconIds[j] === beacon._id) {
          signal = beaconSignals[j]
          break
        }
      }

      if (!beacon.location || (location.accuracy && !beacon.location.accuracy)) {
        updateLocation = true
        updateReason = 'missing'
      }
      else {
        var distanceInKm = util.haversine(
            beacon.location.lat,
            beacon.location.lng,
            location.lat,
            location.lng
          )
        if (distanceInKm >= 0.2) {
          updateLocation = true
          updateReason = 'distance'
        }
        else if (signal >= -80 
          && (!beacon.location.accuracy || location.accuracy < beacon.location.accuracy )) {
          updateLocation = true
          updateReason = 'accuracy'
        }
        else if (location.accuracy <= 30 &&
            (signal > beacon.beacon.signal 
              || !beacon.beacon.signal)) {
          updateLocation = true
          updateReason = 'signal_strength'
        }
        log(beacon._id + ': haversine distance: ' + distanceInKm)
        log(beacon._id + ': accuracy last: ' + beacon.location.accuracy)
        log(beacon._id + ': accuracy req.body.location: ' + location.accuracy)
        log(beacon._id + ': signal last: ' + beacon.beacon.signal)
        log(beacon._id + ': signal req.body.beaconSignals: ' + signal)
      }

      if (updateLocation) {

        log(beacon._id + ': location will be updated: ' + updateReason)
        beacon.location = location
        beacon.beacon.signal = signal

        /* We don't update activityDate if last update was less than activityDateWindow */
        if (!beacon.activityDate ||
            (beacon.activityDate 
              && (activityDate - beacon.activityDate > util.statics.activityDateWindow))) {
          beacon.activityDate = activityDate
        }

        var options = {
          user: req.user ? req.user : util.adminUser,
          asAdmin: true
        }

        db.entities.safeUpdate(beacon, options, function(err, updatedDoc) {
          if (err) return next(err)
          log('Updated beacon: ', updatedDoc._id)
          updatedDoc.location.updateReason = updateReason
          beaconsUpdated.push(updatedDoc)
          next()
        })

      }
    }

    function finish(err) {
      done(err)
    }
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, beaconsUpdated)
  }
}