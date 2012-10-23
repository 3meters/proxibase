/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')
  , req
  , res
  , entityId
  , beaconId
  , activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity'))
  }

  doInsertEntity(req.body.entity)
}

/*
 * Always insert the entity after beacon and link creation so pre 'save' 
 * logic runs when links exist and we can tickle activityDate for beacons and
 * entities this entity is linking to.
 *
 * >> from George:  I don't think this comment applies any more.  The entity save
 * >> appears to happen first.  
 */

function doInsertEntity(entity) {
  var doc = new gdb.models.entities(entity)
  doc.__user = req.user
  doc.activityDate = activityDate
  doc.save(function (err, savedDoc) {
    if (err) return res.error(err)
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
    log('Starting beacon lookup')
    db.beacons.findOne({_id:offeredBeacon._id}, function(err, beacon) {
      if (err) return res.error(err)
      if (beacon) {
        insertLink()
      }
      else {        
        /* Insert the beacon */
        var doc = new gdb.models.beacons(offeredBeacon)
        doc.__user = req.user
        doc.__adminOwns = true // Beacons are owned by admin
        doc.save(function (err, savedDoc) {
          if (err) return res.error(err)
          beaconId = savedDoc._id
          insertLink()
        })
      }
    })
  }
}

function insertLink() {
  if (!req.body.link) {
    insertObservation()
  }
  else {
    log('Starting link insert')
    req.body.link._from = entityId
    var doc = new gdb.models.links(req.body.link)
    doc.__user = req.user
    doc.save(function (err, savedDoc) {
      if (err) return res.error(err)
      insertObservation()
    })
  }
}

// failures are logged but do not affect call success
function insertObservation() {
  if (!req.body.observation) {
    updateActivityDate()
  }
  else {
    log('Starting observation insert')
    req.body.observation._entity = entityId
    var doc = new gdb.models.observations(req.body.observation)
    doc.__user = req.user
    doc.__adminOwns = true
    // Note that execution continues without waiting for callback from observation save
    doc.save(function (err, savedDoc) {
      if (err || !savedDoc) {
        util.logErr('Server Error: Insert observation failed for request ' + 
            req.tag, err.stack || err)
      }
    })
    updateActivityDate()
  }
}

function updateActivityDate() {
  if (!req.body.skipActivityDate) {
    log('Starting propogate activityDate')
    /* Fire and forget */
    methods.propogateActivityDate(entityId, activityDate)
  }
  done()
}

function done() {
  res.send(201, {
    info: 'Entity insert-o-matic',
    count: 1,
    data: {_id: entityId}
  })
}
