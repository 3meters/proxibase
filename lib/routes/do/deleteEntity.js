/*
 * routes/do/deleteEntity.js
 *
 *   TODO: handle partial failure on handleChildren
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')
  , entityId
  , activityEntityIds
  , activityBeaconIds
  , activityDate

exports.main = function(req, res) {
  // set module vars
  activityEntityIds = []
  activityBeaconIds = []
  if (!(req.body && req.body.entityId)) {
    return res.error(proxErr.missingParam('entityId'))
  }
  activityDate = util.getTimeUTC()
  entityId = req.body.entityId
  doDeleteEntity(req, res)
}

function doDeleteEntity(req, res) {
  /*
   * This action runs through the mogoose security checks.  If it passes
   * all subsequent child deletion bypasses security checks, operating
   * directly on the mongo connnection.
   *
   * Always delete the entity first so pre 'remove' logic runs while
   * links still exist and we can tickle activityDate for beacons and
   * entities this entity is linked to.
   */
  gdb.models.entities.findOne({_id:entityId}, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(proxErr.notFound())
    doc.__user = req.user
    doc.remove(function(err) {
      if (err) return res.error(err)
      handleChildren(req, res)
    })
  })
}

/*
 * Delete the children of an entity, bypassing mongoose security
 * The only security check is on the calling method, doDeleteEntity
 */
function handleChildren(req, res) {
  if (req.body.deleteChildren && req.body.deleteChildren === true) {
    var query = {toTableId:2, fromTableId:2, _to:entityId}
    db.links.find(query).toArray(function(err, links) {
      if (err) return res.error(err)
      var childIds = []
      for (var i = links.length; i--;) {
        childIds.push(links[i]._from)
      }
      db.entities.remove({_id:{$in:childIds}}, {safe:true}, function(err) {
        if (err) return res.error(err)
        updateActivityDateSynch(req, res)
      })
    })
  }
  else {
    updateActivityDateSynch(req, res)
  }
}

function updateActivityDateSynch(req, res) {
  /*
   * We need to update activity dates for first degree linked objects
   * before moving on because the links are going to be deleted.
   */
  if (req.body.skipActivityDate) {
    deleteObservations(req, res)
  }
  else {
    db.links.find({ _from:entityId }).toArray(function(err, links) {
      if (err) {
        util.logErr('Find failed in updateActivityDateSynch')
        deleteObservations(req, res)
      }

      for (var i = links.length; i--;) {
        links[i].toTableId == 2 ? activityEntityIds.push(links[i]._to) : activityBeaconIds.push(links[i]._to)
      }

      /* 
       * Update activityDate for all beacons in the beaconId array 
       * TODO: Should we perform window checking to prevent hotspots like we are in propagateActivityDate
       */
      db.beacons.update({ _id:{ $in:activityBeaconIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
        if (err) {
          util.logErr('Beacons update failed in updateActivityDateSynch')
          deleteObservations(req, res)
        }
        log('Updated activityDate for beacons: ' + activityBeaconIds)
        db.entities.update({ _id:{ $in:activityEntityIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
          if (err) {
            util.logErr('Entities update failed in updateActivityDateSynch')
          }
          log('Updated activityDate for entities: ' + activityEntityIds)
          deleteObservations(req, res)
        })
      })
    })
  }
}

function deleteObservations(req, res) {
  db.observations.remove({_entity:entityId}, {safe:true}, function(err) {
    if (err) return res.error(err)
    deleteLinksFrom(req, res)
  })
}


function deleteLinksFrom(req, res) {
  db.links.remove({_from:entityId}, {safe:true}, function(err) {
    if (err) return res.error(err)
    deleteLinksTo(req, res)
  })
}

function deleteLinksTo(req, res) {
  db.links.remove({_to:entityId}, {safe:true}, function(err) {
    if (err) return res.error(err)
    updateActivityDate(req, res)
  })
}

function updateActivityDate(req, res) {
  /*
   * Finish activity date updates for any second degree entities
   */
  if (!req.body.skipActivityDate) {
    for (var i = activityEntityIds.length; i--;) {
      methods.propogateActivityDate(activityEntityIds[i], activityDate)
    }
  }
  done(req, res)
}

function done(req, res) {
  res.send({
    info: 'Entity deleted',
    count: 1,
    data: {_id: entityId}
  })
}
