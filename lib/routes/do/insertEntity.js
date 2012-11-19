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

  if (req.body.links && !req.body.links instanceof Array) {
    return res.error(proxErr.badType('links must be an array'))
  }

  if (req.body.beacons && !req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be an array'))
  }

  doInsertEntity(req, res)
}

/*
 * Always insert the entity after beacon and link creation so pre 'save' 
 * logic runs when links exist and we can tickle activityDate for beacons and
 * entities this entity is linking to.
 *
 * >> from George:  I don't think this comment applies any more.  The entity save
 * >> appears to happen first.  
 */

function doInsertEntity(req, res) {
  var doc = new gdb.models.entities(req.body.entity)
  
  doc.__user = req.user
  if (req.body.entity.place && req.body.entity.place.source) {
    if (req.body.place.source != 'aircandi' && req.body.place.source != 'user') {
      doc.__user = util.adminUser
    }
  }

  doc.activityDate = req.activityDate
  doc.save(function (err, savedDoc) {
    if (err) return res.error(err)
    req.insertedEntity = savedDoc
    insertBeacons(req, res)
  })
}

function insertBeacons(req, res) {
  if (!req.body.beacons) {
    insertLinks(req, res)
  }
  else {
    log('Starting beacon insert')

    for (var i = req.body.beacons.length; i--;) {
      var beacon = req.body.beacons[i]
      db.collection('beacons').findOne({_id:beacon._id}, function(err, doc) {
        if (err) return res.error(err)

        if (!doc) {
          /* Insert the beacon */
          log('Inserting beacon: ' + beacon._id)
          var doc = new gdb.models.beacons(beacon)
          doc.__user = req.user
          doc.__adminOwns = true // Beacons are owned by admin

          /* Note that execution continues without waiting for callback from save */
          doc.save(function (err, savedDoc) {
            if (err) return res.error(err)
          })
        }
      })
    }
    insertLinks(req, res)
  }
}

function insertLinks(req, res) {
  if (!req.body.links) {
    insertObservation(req, res)
  }
  else {
    log('Starting link insert')

    for (var i = req.body.links.length; i--;) {
      req.body.links[i]._from = req.insertedEntity._id
      var doc = new gdb.models.links(req.body.links[i])
      doc.__user = req.user

      /* Note that execution continues without waiting for callback from save */
      doc.save(function (err, savedDoc) {
        if (err) return res.error(err)
      })    
    }
    insertObservation(req, res)
  }
}

/* failures are logged but do not affect call success */
function insertObservation(req, res) {
  /* 
   * If there are multiple beacons, the observation should apply to
   * the strongest beacon.
   */
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
        util.logErr('Server Error: Insert observation failed for request ' 
          + req.tag, err.stack || err)
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
