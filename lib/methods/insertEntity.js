/*
 * insertEntity
 */

var
  gdb = require('../main').gdb,   // mongodb connection object
  db = require('../main').db,     // mongoskin connection object
  log = require('../util').log,
  methods = require('./methods'),
  util = require('../util'),  
  req,
  res,
  entityId,
  beaconId,
  userId,
  activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()

  if (!(req.body && req.body.entity)) {
    return res.sendErr(new Error('request.body.entity is required'))
  }
  
  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("request.body.userId must be string type"))
  }

  doInsertEntity(req.body.entity)
}

/*
 * Always insert the entity after beacon and link creation so pre 'save' 
 * logic runs when links exist and we can tickle activityDate for beacons and
 * entities this entity is linking to.
 */

function doInsertEntity(entity) {
  if (req.body.userId) {
    userId = req.body.userId
    entity._owner = userId
    entity._creator = userId
    entity._modifier = userId
  }
  var doc = new gdb.models['entities'](entity)
  doc.activityDate = activityDate
  doc.save(function (err, savedDoc) {
    if (err) return res.sendErr(err)
    if (!savedDoc._id) {
      var err =  new Error('Insert failed for unknown reason. Call for help')
      logErr('Server error: ' +  err.message)
      logErr('Document:', doc)
      res.sendErr(err, 500)
    }
    entityId = savedDoc._id
    insertBeacon()
  })
}

function insertBeacon() {
  if (!req.body.beacon) {
    insertLink()
  }
  else {
    var offeredBeacon = req.body.beacon
    db.collection('beacons').findOne({_id:offeredBeacon._id}, function(err, beacon) {
      if (err) return res.sendErr(err)
      if (beacon) {
        beaconId = beacon._id

        /* 
         * Check to see if we have better location info 
         * TODO: Should we upgrade the location if the observation 
         * levelDb is stronger than we currently have?
         */
        var betterLocation = false
        if (!beacon.latitude && offeredBeacon.latitude) {
          betterLocation = true
        }
        else if (offeredBeacon.accuracy && (!beacon.accuracy || offeredBeacon.accuracy < beacon.accuracy)) {
          betterLocation = true
        }
        if (betterLocation) {
          beacon.latitude = offeredBeacon.latitude
          beacon.longitude = offeredBeacon.longitude
          beacon.altitude = offeredBeacon.altitude
          beacon.accuracy = offeredBeacon.accuracy
          beacon.bearing = offeredBeacon.bearing
          beacon.speed = offeredBeacon.speed
          updateBeacon(beacon)
        }
        else {
          insertLink()
        }
      }
      else {
        /* Insert the beacon */
        if (userId) {
          offeredBeacon._owner = userId
          offeredBeacon._creator = userId
          offeredBeacon._modifier = userId
        }
        var doc = new gdb.models['beacons'](offeredBeacon)
        doc.save(function (err, savedDoc) {
          if (err) return res.sendErr(err)
          if (!savedDoc._id) {
            var err =  new Error('Insert failed for unknown reason. Call for help')
            logErr('Server error: ' +  err.message)
            logErr('Document:', doc)
            res.sendErr(err, 500)
          }
          beaconId = savedDoc._id
          insertLink()
        })
      }
    })
  }
}

function updateBeacon(beacon) {
  gdb.models['beacons'].findOne({ _id: beacon._id}, function (err, doc) {
    if (err) return res.sendErr(err)
    if (!doc) return res.sendErr(404)
    for (prop in beacon) {
      doc[prop] = beacon[prop]
    }
    doc.save(function(err, updatedDoc) {
      if (err) return res.sendErr(err)
      if (!updatedDoc) {
        var err = new Error('Beacon update failed for unknown reason for doc ' + beacon._id + ' Call for help')
        log('Error ' + err.message)
        return res.sendErr(err, 500)
      }
      insertLink()
    })
  })
}

function insertLink() {
  if (!req.body.link) {
    insertObservation()
  }
  else {
    if (req.body.userId) {
      req.body.link._owner = userId
      req.body.link._creator = userId
      req.body.link._modifier = userId
    }
    req.body.link._from = entityId
    var doc = new gdb.models['links'](req.body.link)
    doc.save(function (err, savedDoc) {
      if (err) return res.sendErr(err)
      if (!savedDoc._id) {
        var err =  new Error('Insert failed for unknown reason. Call for help')
        logErr('Server error: ' +  err.message)
        logErr('Document:', doc)
        res.sendErr(err, 500)
      }
      insertObservation()
    })
  }
}

function insertObservation() {
  if (!req.body.observation) {
    updateActivityDate()
  }
  else {
    if (req.body.userId) {
      req.body.observation._owner = userId
      req.body.observation._creator = userId
      req.body.observation._modifier = userId
    }
    req.body.observation._entity = entityId
    var doc = new gdb.models['observations'](req.body.observation)
    doc.save(function (err, savedDoc) {
      if (err) return res.sendErr(err)
      if (!savedDoc._id) {
        var err =  new Error('Insert failed for unknown reason. Call for help')
        logErr('Server error: ' +  err.message)
        logErr('Document:', doc)
        res.sendErr(err, 500)
      }
      updateActivityDate()
    })
  }
}

function updateActivityDate() {
  if (!req.body.skipActivityDate) {
    /* Fire and forget */
    methods.propogateActivityDate(entityId, activityDate)
  }
  done()
}

function done() {
  res.send({
    info: 'Entity insert-o-matic',
    count: 1,
    data: {_id: entityId}
  })
}
