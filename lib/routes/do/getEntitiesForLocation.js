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

  var beaconIdsToProcess = []
  var beaconLevelsToProcess = []
  var entityIdsToProcess = []

  var beaconIdsTracked = []
  var entityIdsTracked = []
  var linksTracked = []

  var options = {
        limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
        children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
        parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
        comments:{limit:util.statics.optionsLimitDefault, skip:0}
      }
  var activityDate = util.getTimeUTC()

  // request body template
  var _body = {
    beaconIdsNew:       {type: 'array'},
    beaconIdsRefresh:   {type: 'array'},
    beaconLevels:       {type: 'array'},
    refreshDate:        {type: 'number'},
    radius:             {type: 'number'},
    eagerLoad:          {type: 'object', default: { children:false, comments:false, parents:false }},
    fields:             {type: 'object', default: {}},
    linkType:           {type: 'string'},
    filter:             {type: 'string'},
    registrationId:     {type: 'string'},
    observation:        {type: 'object'},
    options:            {type: 'object', default: options},
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (req.body.beaconLevels && req.body.beaconIdsNew) {
    if (req.body.beaconLevels.length != req.body.beaconIdsNew.length) {
      return res.error(proxErr.badValue('beaconLevels.length should equal beaconIdsNew.length'))
    }
  }

  if (req.body.beaconIdsRefresh && !req.body.refreshDate) {
    return res.error(proxErr.missingParam('If passing beaconIdsRefresh[] refreshDate is required'))
  }

  if (!req.body.options.children) {
    req.body.options.children = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.parents) {
    req.body.options.parents = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.comments) {
    req.body.options.comments = {limit:util.statics.optionsLimitDefault, skip:0}
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.limit exceeded'))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.children.limit exceeded'))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.parents.limit exceeded'))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.comments.limit exceeded'))
  }

  if (req.body.beaconIdsNew) {
    beaconIdsToProcess = req.body.beaconIdsNew
    if (req.body.beaconLevels) {
      beaconLevelsToProcess = req.body.beaconLevels
    }
    beaconIdsTracked = beaconIdsTracked.concat(req.body.beaconIdsNew)
  }

  if (req.body.beaconIdsRefresh) {
    beaconIdsTracked = beaconIdsTracked.concat(req.body.beaconIdsRefresh)
  }

  doDeviceUpdate()

  function doDeviceUpdate() {

    if (!req.body.registrationId || !req.body.beaconIdsNew) {
      getRefreshBeacons()
    }
    else {
      db.devices.findOne({ registrationId: req.body.registrationId }, function(err, doc) {
        if (err) return res.error(err)
        if (!doc) return res.error(perr.notFound())

        doc.beacons = req.body.beaconIdsNew
        doc.beaconsDate = util.getTime()

        var options = {
          asAdmin: true,
          user: util.adminUser
        }

        db.devices.safeUpdate(doc, options, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())
          getRefreshBeacons()
        })
      })
    }
  }

  function getRefreshBeacons() {
    /*
     * Find beacons we are already tracking that are dirty and need to be refreshed
     */
    if (!req.body.beaconIdsRefresh) {
      updateBeaconLocation()
    }
    else {
      /* Find stale beacons */
      var query = { activityDate:{ $gt:req.body.refreshDate }, _id:{ $in:req.body.beaconIdsRefresh }}
      db.beacons
        .find(query, {_id:true})
        .toArray(function(err, beacons) {
          if (err) return res.error(err)
          for (var i = beacons.length; i--;) {
            beaconIdsToProcess.push(beacons[i]._id)
          }
          updateBeaconLocation()
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
    if (!req.body.observation) {
      getEntityLinksTracked()
    }
    else {
      if (!req.body.beaconIdsNew) { 
        getEntityLinksTracked()
      }
      else {
        /* Find the beacons */
        var query = { _id:{ $in:req.body.beaconIdsNew }}

        db.beacons
          .find(query)
          .toArray(function(err, beacons) {
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
                for (var j = req.body.beaconIdsNew.length; j--;) {
                  if (req.body.beaconIdsNew[j] === beacons[i]._id) {
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
                var distanceInKm = methods.haversine(
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
            getEntityLinksTracked()
        })
      }
    }
  }

  /*
   * beaconIdsToProcess:    Only entities linked to these beacons need to be returned.
   * beaconIdsTracked:  The more flag must be based on entities for all tracked beacons.
   */

  function getEntityLinksTracked() {
    /*
     * This isn't limited internally so could be a perf/security problem.
     */
    if (beaconIdsTracked.length == 0) {
      getEntitiesTracked()
    }
    else {
      var query = { toCollectionId:'0008', _to:{ $in:beaconIdsTracked }}
      if (req.body.linkType) {
        query = { toCollectionId:'0008', _to:{ $in:beaconIdsTracked }, type:req.body.linkType}
      }
      db.links
        .find(query, {_from:true,_to:true,_id:false})
        .limit(util.statics.internalLimit + 1)
        .toArray(function(err, links) {

        if (err) return res.error(err)

        if (links.length > util.statics.internalLimit) {
          links.pop()
          logErr('getEntitiesForLocation: links LimitMax exceeded, request tag: ' + req.tag)
        }

        linksTracked = links
        for (var i = links.length; i--;) {
          entityIdsTracked.push(links[i]._from)
        }
        getEntitiesTracked()
      })
    }
  }

  function getEntitiesTracked() {
    /*
     * entityIdsTracked could contain the same entity multiple times because an entity can 
     * be linked to more more than one beacon in the area. The query below should still only
     * return the entity once.
     */

    if (entityIdsTracked.length == 0) {
      getEntitiesByLocation()
    }
    else {
      var query
      if (req.user) {
        query = { _id:{ $in:entityIdsTracked}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.user._id }]}
      }
      else {
        query = { _id:{ $in:entityIdsTracked}, enabled:true, visibility:'public'}
      }

      db.entities
        .find(query, { _id:true, activityDate:true })
        .sort(req.body.options.sort)
        .skip(req.body.options.skip)
        .limit(req.body.options.limit + 1)
        .toArray(function(err, entitiesTracked) {

        if (err) return res.error(err)

        /* 
         * more is based on the full set of tracked entities even though
         * some might not be returned because of optimization.
         */
        if (entitiesTracked.length > req.body.options.limit ) {
          entitiesTracked.pop()
          more = true
        }

        /* Brutal scan to find entities that link back to stale beacons */

        for (var i = entitiesTracked.length; i--;) {
          for (var j = linksTracked.length; j--;) {
            if (linksTracked[j]._from === entitiesTracked[i]._id) {
              var beaconId = linksTracked[j]._to;
              for (var k = beaconIdsToProcess.length; k--;) {
                if (beaconIdsToProcess[k] === beaconId) {
                  entityIdsToProcess.push(entitiesTracked[i]._id)
                }
              }
            }
          }
        }

        getEntitiesByLocation()
      })
    }
  }

  function getEntitiesByLocation() {
    /*
     * Search for entities that are near the location and not already part
     * of the list we plan to process
     */
    if (req.body.observation && req.body.radius) {
      var radians = req.body.radius / 6378137  // radius of the earth in meters
      var query = {
        loc:{ $within:{ $centerSphere:[[req.body.observation.longitude, req.body.observation.latitude], radians] }},
        _id:{ $nin:entityIdsToProcess }
      }
      db.entities
        .find(query, { _id:true, activityDate:true })
        .limit(req.body.options.limit + 1)
        .toArray(function(err, entities) {
          if (err) return res.error(err)
          entities.forEach(function(entity) {
            entityIdsToProcess.push(entity._id)
          })
          loadEntities()
       })
     }
    else {
      loadEntities()
    }
  }

  function loadEntities() {
      if (entityIdsToProcess.length == 0) {
        res.send({
          data: [],
          date: util.getTimeUTC(),
          count: 0,
          more: more
        })
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
            res.send({
              data: entities,
              date: util.getTimeUTC(),
              count: entities.length,
              more: more
            })
        })
      }
  }
}
