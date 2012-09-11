/*
 * getEntitiesForBeacons
 */

var
  util = require('../../util'),
  db = util.db,
  gdb = util.gdb,
  log = util.log,
  logErr = util.logErr,
  methods = require('./methods'),
  _ = require('underscore'),
  options = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}, 
    children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
    parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
    comments:{limit:util.statics.optionsLimitDefault, skip:0}
  },
  more,
  req,
  res,
  beaconIdsStale,
  beaconIdsTracked,
  entityIdsStale,
  entityIdsTracked,
  linksTracked,
  activityDate,
  count

exports.main = function(request, response) {

  /*
   * TODO: Should we limit the number of beaconIds that can be passed in.
   */
  req = request
  res = response
  more = false
  beaconsIdsStale = []
  beaconLevelsStale = []
  beaconIdsTracked = []
  entityIdsStale = []
  entityIdsTracked = []
  linksTracked = []
  activityDate = util.getTimeUTC()

  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!req.body.beaconIdsNew && !req.body.beaconIdsRefresh) {
    return res.sendErr(new Error("Either beaconIdsNew[] or beaconIdsRefresh[] is required"))
  }

  if (req.body.beaconIdsNew && !req.body.beaconIdsNew instanceof Array) {
    return res.sendErr(new Error("beaconIdsNew[] must be array type"))
  }

  if (req.body.beaconLevels && !req.body.beaconLevels instanceof Array) {
    return res.sendErr(new Error("beaconLevels must be array type"))
  }

  if (req.body.beaconIdsRefresh) {
    if (!req.body.beaconIdsRefresh instanceof Array) {
      return res.sendErr(new Error("beaconIdsRefresh[] must be array type"))
    }
    if (!req.body.refreshDate) {
      return res.sendErr(new Error("If passing beaconIdsRefresh[] then refreshDate is required"))
    }
    else if (typeof req.body.refreshDate !== 'number') {
      return res.sendErr(new Error("refreshDate must be number type"))
    }
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("eagerLoad must be object type"))
  }

  if (req.body.filter && typeof req.body.filter !== 'string') {
    return res.sendErr(new Error("filter must be string type"))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.sendErr(new Error("options must be object type"))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("userId must be string type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false,parents:false}
  }

  if (!req.body.userId) {
    req.body.userId = '0000.000000.00000.000.000000'
  }

  if (!req.body.fields) {
    req.body.fields = {}
  }

  if (!req.body.options) {
    req.body.options = options
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
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.children.limit exceeded"))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.parents.limit exceeded"))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.comments.limit exceeded"))
  }

  if (req.body.beaconIdsNew) {
    beaconIdsStale = req.body.beaconIdsNew
    if (req.body.beaconLevels) {
      beaconLevelsStale = req.body.beaconLevels
    }
    beaconIdsTracked = beaconIdsTracked.concat(req.body.beaconIdsNew)
  }

  if (req.body.beaconIdsRefresh) {
    beaconIdsTracked = beaconIdsTracked.concat(req.body.beaconIdsRefresh)
  }

  log(beaconIdsTracked)

  getRefreshBeacons()
}

function getRefreshBeacons() {
  if (!req.body.beaconIdsRefresh) {
    updateBeaconLocation()
  }
  else {
    /* Find stale beacons */
    var query = { activityDate:{ $gt:req.body.refreshDate }, _id:{ $in:req.body.beaconIdsRefresh }}
    db.collection('beacons')
      .find(query, {_id:true})
      .toArray(function(err, beacons) {

      if (err) return res.sendErr(err)
      for (var i = beacons.length; i--;) {
        beaconIdsStale.push(beacons[i]._id)
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
   */
  if (!req.body.observation) {
    getEntityLinksTracked()
  }
  else {
    if (req.body.beaconIdsNew) { 

      /* Find the beacons */
      var observation = req.body.observation
      var query = { _id:{ $in:req.body.beaconIdsNew }}

      db.collection('beacons')
        .find(query)
        .toArray(function(err, beacons) {
          if (err) return res.sendErr(err)

          for (var i = beacons.length; i--;) {
            /* Skip our special global beacon */
            if (beacons[i]._id == '0003:00:00:00:00:00:00') {
              continue
            }

            /* 
             * We want to find beacons that have moved and need to 
             * have their location info updated.
             */
            var updateLocation = false
            var updateReason = 'unknown'
            var level
            var distanceInKm = methods.haversine(beacons[i].latitude, beacons[i].longitude, observation.latitude, observation.longitude)

            if (req.body.beaconLevels) {
              for (var j = req.body.beaconIdsNew.length; j--;) {
                if (req.body.beaconIdsNew[j] === beacons[i]._id) {
                  level = req.body.beaconLevels[j]
                  break
                }
              }
            }

            if (distanceInKm >= 0.2) {
              updateLocation = true
              updateReason = 'distance'
            }
            else if (level >= -80 && (observation.accuracy < beacons[i].accuracy || !beacons[i].accuracy)) {
              updateLocation = true
              updateReason = 'accuracy'
            }
            else if (observation.accuracy <= 30 && (level > beacons[i].level || !beacons[i].level)) {
              updateLocation = true
              updateReason = 'level strength'
            }

            log(beacons[i]._id + ': haversine distance: ' + distanceInKm)
            log(beacons[i]._id + ': accuracy last: ' + beacons[i].accuracy)
            log(beacons[i]._id + ': accuracy observation: ' + observation.accuracy)
            log(beacons[i]._id + ': level last: ' + beacons[i].level)
            log(beacons[i]._id + ': level observation: ' + level)

            if (updateLocation)

              log(beacons[i]._id + ': location will be updated: ' + updateReason)

              // /* Update the beacon */
              // gdb.models['beacons'].findOne({ _id: beacons[i]._id}, function (err, doc) {
              //   if (err) return res.sendErr(err)
              //   doc.latitude = observation.latitude
              //   doc.longitude = observation.longitude
              //   doc.altitude = observation.altitude
              //   doc.speed = observation.speed
              //   doc.bearing = observation.bearing
              //   doc.accuracy = observation.accuracy
              //   doc.level = level
              //   doc.__asAdmin = true
                 
              //    * We don't update activityDate if last update was less than activityDateWindow 
                 
              //   if (!doc.activityDate || (doc.activityDate && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {
              //     doc.activityDate = activityDate
              //   }

              //   doc.save(function(err, updatedDoc) {
              //     if (err) return res.sendErr(err)
              //     if (!updatedDoc) {
              //       var err = new Error('Beacon location update failed for unknown reason for doc ' + beacons[i]._id + ' Call for help')
              //       logErr('Server error: ' +  err.message)
              //       return res.sendErr(err, 500)
              //     }
              //   })
              // })
          }
          getEntityLinksTracked()
      })
    }
  }
}

/*
 * beaconIdsStale:    Only entities linked to these beacons need to be returned.
 * beaconIdsTracked:  The more flag must be based on entities for all tracked beacons.
 */

function getEntityLinksTracked() {
  /*
   * This isn't limited internally so could be a perf/security problem.
   */
  var query = { toTableId:3, _to:{ $in:beaconIdsTracked }}
  db.collection('links')
    .find(query, {_from:true,_to:true,_id:false})
    .limit(util.statics.internalLimit + 1)
    .toArray(function(err, links) {

    if (err) return res.sendErr(err)

    if (links.length > util.statics.internalLimit) {
      links.pop()
      logErr('getEntitiesForBeacons: linksLimitMax exceeded, request tag: ' + req.tag)
    }

    linksTracked = links
    for (var i = links.length; i--;) {
      entityIdsTracked.push(links[i]._from)
    }
    getEntitiesTracked()
  })
}

function getEntitiesTracked() {

  var query = { _id:{ $in:entityIdsTracked}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId }]}
  if (req.body.filter) {
    query = { _id:{ $in:entityIdsTracked}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId }], namelc: { $regex: '^' + req.body.filter, $options: 'i'}}
  }

  db.collection('entities')
    .find(query, { _id:true, activityDate:true })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entitiesTracked) {

    if (err) return res.sendErr(err)

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
          for (var k = beaconIdsStale.length; k--;) {
            if (beaconIdsStale[k] === beaconId) {
              entityIdsStale.push(entitiesTracked[i]._id)
            }
          }
        }
      }
    }

    if (entityIdsStale.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      /*
       * Build and return the entities that are new or stale.
       */
      methods.getEntities(entityIdsStale, req.body.eagerLoad, req.body.beaconIdsNew, req.body.observation, null, req.body.options, more, res)
    }
  })
}
