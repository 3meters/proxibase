/**
 * getEntitiesForLocation
 */

var db = util.db
var methods = require('./methods')
var getEntities = require('./getEntities').run

exports.main = function(req, res) {
  /*
   * TODO: Should we limit the number of beaconIds that can be passed in.
   */
  var more = false
  var entities = []
  var entityIds = []
  var activityDate = util.getTimeUTC()

  /* Request body template start ========================================= */
  var activeLink = {
    fields = {    
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      links:      { type: 'boolean', default: false },
      namespace:  { type: 'string', default: 'com.aircandi' },
      limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax50
          }
          return null
        },
      },
    }
  }
  var _body = {
    beaconIds:      { type: 'array', required: true },
    linkSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    linkWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects    
    activeLinks:    { type: 'object', strict: false, value: {               
        post:         { type: 'object', value: activeLink.fields },
        applink:      { type: 'object', value: activeLink.fields },
        comment:      { type: 'object', value: activeLink.fields },
        like:         { type: 'object', value: activeLink.fields },
        watch:        { type: 'object', value: activeLink.fields },
        proximity:    { type: 'object', value: activeLink.fields },
      },
    },    
    beaconLevels:   { type: 'array' },
    observation:    { type: 'object' },
    registrationId: { type: 'string' },
  }
  /* Request body template end =========================================*/

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (req.body.beaconLevels || req.body.observation) {
    if (!(req.body.beaconLevels && req.body.observation)) {
      return res.error(proxErr.badValue('if either beaconLevels or observation are passed then both are required'))
    }
    else if (req.body.beaconLevels.length !== req.body.beaconIds.length) {
      return res.error(proxErr.badValue('beaconLevels.length should equal beaconIds.length'))
    }
  }

  doDeviceUpdate()

  function doDeviceUpdate() {

    if (!req.body.registrationId) {
      updateBeaconLocation()
    }
    else {
      db.devices.findOne({ registrationId: req.body.registrationId }, function(err, doc) {
        if (err) return res.error(err)
        /* 
         * An unregistered/invalid registrationId isn't great but shouldn't prevent
         * the call from proceeding 
         */
        if (!doc) return updateBeaconLocation()

        doc.beacons = req.body.beaconIds
        doc.beaconsDate = util.getTime()

        var options = {
          asAdmin: true,
          user: util.adminUser
        }

        db.devices.safeUpdate(doc, options, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())
          updateBeaconLocation()
        })
      })
    }
  }

  function updateBeaconLocation() {
    /*
     *
     * Beacons can move so we capture an observation each time a client
     * first detects a beacon as part of a radar scan and an observation
     * was sent.
     *
     * TODO: Should we only record observations for beacons already in the system.
     *
     * Beacons are updated in parallel and non-blocking
     */
    if (!(req.body.observation && req.body.beaconIds)) {
      getEntityIds()
    }
    else {
      /* Find the beacons */
      var query = { _id:{ $in: req.body.beaconIds }}
      db.beacons.find(query).toArray(function(err, beacons) {
        if (err) return res.error(err)

        for (var i = beacons.length; i--;) {
          if (beacons[i]._id === util.statics.globalBeacon._id) {
            continue
          }
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
          if (req.body.beaconLevels) {
            for (var j = req.body.beaconIds.length; j--;) {
              if (req.body.beaconIds[j] === beacons[i]._id) {
                level = req.body.beaconLevels[j]
                break
              }
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
                (req.body.observation.accuracy < beacons[i].accuracy || !beacons[i].accuracy)) {
              updateLocation = true
              updateReason = 'accuracy'
            }
            else if (req.body.observation.accuracy <= 30 &&
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
                latitude: req.body.observation.latitude,
                longitude: req.body.observation.longitude,
                altitude: req.body.observation.altitude,
                speed: req.body.observation.speed,
                bearing: req.body.observation.bearing,
                accuracy: req.body.observation.accuracy,
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
        getEntityIds()
      })
    }
  }

  function getEntityIds() {
    /*
     * This isn't limited internally so could be a perf/security problem.
     */
    var query = { toCollectionId:'0008', _to:{ $in:beaconIdsTracked }}
    db.links
      .find(query, { _from: true, _to: true,_id: false })
      .limit(util.statics.internalLimit + 1)
      .toArray(function(err, links) {

      if (err) return res.error(err)
      if (links.length === 0) finish()

      if (links.length > util.statics.internalLimit) {
        links.pop()
        logErr('getEntitiesForLocation: links LimitMax exceeded, request tag: ' + req.tag)
      }

      for (var i = links.length; i--;) {
        entityIds.push(links[i]._from)
      }

      var query = { _id:{ $in:entityIds}, enabled:true }
      if (req.body.where) {
        query = { $and: [query, req.body.where] }
      }
      db.entities
        .find(query, { _id:true, activityDate:true })
        .sort(req.body.sort)
        .limit(req.body.limit + 1)
        .toArray(function(err, entities) {

        if (err) return res.error(err)
        /* 
         * more is based on the full set of tracked entities even though
         * some might not be returned because of optimization.
         */
        if (entities.length > req.body.limit ) {
          entities.pop()
          more = true
        }

        getEntitiesTracked()
      })
    })
  }

  function loadEntities() {
    if (entityIdsToProcess.length == 0) {
      finish()
    }
    else {
      /* Last step is to remove any entities that were flagged in excludeEntityIds */
      var entityIds = []
      if (!req.body.excludeEntityIds) {
        entityIds = entityIdsToProcess
      }
      else {
        for (var i = entityIdsToProcess.length; i--;) {
          var match = false
          for (var j = req.body.excludeEntityIds.length; j--;) {
            if (entityIdsToProcess[i] == req.body.excludeEntityIds[j]) {
              match = true
              break
            }
          }
          if (!match) {
            entityIds.push(entityIdsToProcess[i])
          }
        }
      }

      /* Build and return the entities that are new or stale. */
      getEntities(req, {
        entityIds: entityIds,
        eagerLoad: req.body.eagerLoad,
        beaconIds: req.body.beaconIdsNew,
        fields: null,
        options: req.body.options
        }
        , function(err, entities) {
          if (err) return res.error(err)
          finish()
      })
    }
  }

  finish() {
    res.send({
      data: entities,
      date: util.getTimeUTC(),
      count: entities.length,
      more: more
    })
  }
}
