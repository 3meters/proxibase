/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')

module.exports.main = function(req, res) {

  /* Shared variables */
  req.activityDate = util.getTimeUTC()
  req.insertedEntity = {}

  if (!(req.body && (req.body.entity || req.body.entities))) {
    return res.error(proxErr.missingParam('entity object or entities array is required'))
  }

  if (req.body.entities && !req.body.entities instanceof Array) {
    return res.error(proxErr.badType('entities must be an array'))
  }

  if (req.body.entity && typeof req.body.entity !== 'object') {
    return res.error(proxErr.badType('entity must be an object'))
  }

  doInsertEntity(req.body.entity, req, res)
}

/*
 * Always insert the entity after beacon and link creation so pre 'save' 
 * logic runs when links exist and we can tickle activityDate for beacons and
 * entities this entity is linking to.
 *
 * >> from George:  I don't think this comment applies any more.  The entity save
 * >> appears to happen first.  
 */

function doInsertEntity(entity, req, res) {
  var doc = new gdb.models.entities(entity)
  doc.__user = req.user
  doc.activityDate = req.activityDate
  doc.save(function (err, savedDoc) {
    if (err) return res.error(err)
    req.insertedEntity = savedDoc
    insertBeacon(req, res)
  })
}

function insertBeacon(req, res) {
  if (!req.body.beacon) {
    insertLink(req, res)
  }
  else {
    var offeredBeacon = req.body.beacon
    log('Starting beacon lookup')
    db.beacons.findOne({_id:offeredBeacon._id}, function(err, beacon) {
      if (err) return res.error(err)
      if (beacon) {
        insertLink(req, res)
      }
      else {        
        /* Insert the beacon */
        var doc = new gdb.models.beacons(offeredBeacon)
        doc.__user = req.user
        doc.__adminOwns = true // Beacons are owned by admin
        doc.save(function (err, savedDoc) {
          if (err) return res.error(err)
          insertLink(req, res)
        })
      }
    })
  }
}

function insertLink(req, res) {
  if (!req.body.link) {
    insertObservation(req, res)
  }
  else {
    log('Starting link insert')
    req.body.link._from = req.insertedEntity._id
    var doc = new gdb.models.links(req.body.link)
    doc.__user = req.user
    doc.save(function (err, savedDoc) {
      if (err) return res.error(err)

      if (req.body.link.plus) {
        methods.logAction(savedDoc._id, 'aircandi', 'tune', req)
      }

      insertObservation(req, res)
    })
  }
}

// failures are logged but do not affect call success
function insertObservation(req, res) {
  if (!req.body.observation) {
    updateActivityDate(req, res)
  }
  else {
    log('Starting observation insert')
    req.body.observation._entity = req.insertedEntity._id
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
    updateActivityDate(req, res)
  }
}

function updateActivityDate(req, res) {
  if (!req.body.skipActivityDate) {
    log('Starting propogate activityDate')
    /* Fire and forget */
    methods.propogateActivityDate(req.insertedEntity._id, req.activityDate)
  }
  done(req, res)
}

function done(req, res) {
  res.send(201, {
    data: req.insertedEntity,
    date: util.getTimeUTC(),
    count: 1,
  })
}
