/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var util = require('util')
var db = util.db
var log = util.log
var methods = require('./methods')

exports.main = function(req, res) {

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity'))
  }

  var entity = req.body.entity
  var activityDate = util.getTime()
  var entityId
  var beaconId

  /*
   * Always insert the entity after beacon and link creation so pre 'save' 
   * logic runs when links exist and we can tickle activityDate for beacons and
   * entities this entity is linking to.
   *
   * >> from George:  I don't think this comment applies any more.  The entity save
   * >> appears to happen first.  
   */

  entity.activityDate = activityDate
  db.entities.safeInsert(entity, {user:req.user}, function (err, savedDoc) {
    if (err) return res.error(err)
    entityId = savedDoc._id
    insertBeacon()
  })

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
          db.beacons.safeInsert(
            offeredBeacon,
            {user:req.user, adminOwns:true},
            function (err, savedDoc) {
              if (err) return res.error(err)
              beaconId = savedDoc._id
              insertLink()
            }
          )
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
      var link = req.body.link
      link._from = entityId
      db.links.safeInsert(link, {user: req.user}, function(err, savedDoc) {
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
      var observation = req.body.observation
      observation._entity = entityId
      // Note that execution continues without waiting for callback from observation save
      db.observations.safeInsert(
        observation,
        {user:req.user, adminOwns:true},
        function (err, savedDoc) {
          if (err || !savedDoc) {
            util.logErr('Server Error: Insert observation failed for request ' + 
                req.tag, err.stack || err)
          }
        }
      )
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
}
