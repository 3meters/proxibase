/**
 * updateBeaconLocation
 */

var db = util.db
var methods = require('./methods')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    beaconIds:      { type: 'array', required: true },
    beaconLevels:   { type: 'array', required: true },
    observation:    { type: 'object', required: true },
  }

  /* Request body template end =========================================*/

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (req.body.beaconLevels.length !== req.body.beaconIds.length) {
    return res.error(proxErr.badValue('beaconLevels.length should equal beaconIds.length'))
  }

  run(req, {
    beaconIds: req.body.beaconIds,
    beaconLevels: req.body.beaconLevels,
    observation: req.body.observation,
    }
    , function(err, beacons) {
      if (err) return res.error(err)
      res.send({
        data: beacons,
        date: util.getTimeUTC(),
        count: beacons.length,
        more: false
      })      
  })
}

var run = exports.run = function(req, options, cb) {

  var beacons = []
  var activityDate = util.getTimeUTC()

  getBeacons()

  function getBeacons() {
    var query = { _id:{ $in: options.beaconIds }, enabled: true }
    db.beacons.find(query).toArray(function(err, docs) {
      if (err) return finish(err)

      if (docs.length === 0) finish()
      beacons = docs
      updateBeaconLocation()
    })
  }

  function updateBeaconLocation() {
    /*
     * Beacons can move so we capture an observation each time a client
     * first detects a beacon as part of a radar scan and an observation
     * was sent.
     *
     * TODO: Should we only record observations for beacons already in the system.
     *
     * Beacons are updated in parallel and non-blocking
     */
    for (var i = beacons.length; i--;) {
      /*
       * We want to find beacons that have moved or are missing
       * location data and need to have their location info updated.
       */
      var updateLocation = false
      var updateReason = 'unknown'
      var level
      /*
       * If the caller can provide a beacon, they should be able
       * to provide the signal level.
       */
      for (var j = options.beaconIds.length; j--;) {
        if (options.beaconIds[j] === beacons[i]._id) {
          level = options.beaconLevels[j]
          break
        }
      }

      if (!beacons[i].latitude || !beacons[i].longitude || !beacons[i].accuracy || !beacons[i].level) {
        updateLocation = true
        updateReason = 'missing'
      }
      else {
        var distanceInKm = util.haversine(
            beacons[i].latitude,
            beacons[i].longitude,
            req.body.observation.latitude,
            req.body.observation.longitude
          )
        if (distanceInKm >= 0.2) {
          updateLocation = true
          updateReason = 'distance'
        }
        else if (level >= -80 &&
            (options.observation.accuracy < beacons[i].accuracy || !beacons[i].accuracy)) {
          updateLocation = true
          updateReason = 'accuracy'
        }
        else if (options.observation.accuracy <= 30 &&
            (level > beacons[i].level || !beacons[i].level)) {
          updateLocation = true
          updateReason = 'level strength'
        }
        // log(beacons[i]._id + ': haversine distance: ' + distanceInKm)
        // log(beacons[i]._id + ': accuracy last: ' + beacons[i].accuracy)
        // log(beacons[i]._id + ': accuracy req.body.observation: ' + req.body.observation.accuracy)
        // log(beacons[i]._id + ': level last: ' + beacons[i].level)
        // log(beacons[i]._id + ': level req.body.observation: ' + level)
      }

      if (updateLocation) {

        log(beacons[i]._id + ': location will be updated: ' + updateReason)

        /* Update the beacon */
        db.beacons.findOne({ _id: beacons[i]._id}, function (err, foundBeacon) {
          if (err) return res.error(err)
          var doc = {
            _id: foundBeacon._id,
            latitude: options.observation.latitude,
            longitude: options.observation.longitude,
            altitude: options.observation.altitude,
            speed: options.observation.speed,
            bearing: options.observation.bearing,
            accuracy: options.observation.accuracy,
            level: level
          }
          /* We don't update activityDate if last update was less than activityDateWindow */
          if (!doc.activityDate ||
              (doc.activityDate && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {
            doc.activityDate = activityDate
          }
          var options = {
            user: req.user ? req.user : util.adminUser,
            asAdmin: true
          }
          db.beacons.safeUpdate(doc, options, function(err, updatedDoc) {
            if (err) util.logErr(err.stack || err)
            else log('Updated beacon: ', updatedDoc)
          })
        })
      }
    }
    finish()
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}