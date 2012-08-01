/*
 * deleteEntity
 *   TODO: handle partial failure on handleChildren
 */

var
  gdb = require('../main').gdb,
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),  
  methods = require('./methods'),
  req,
  res,
  entityId,
  activityEntityIds,
  activityBeaconIds,
  activityDate

exports.main = function(request, response) {
  // set module vars
  req = request
  res = response
  activityEntityIds = []
  activityBeaconIds = []
  if (!(req.body && req.body.entityId)) {
    return res.sendErr(new Error('request.body.entityId is required'))
  }
  activityDate = util.getTimeUTC()
  entityId = req.body.entityId
  doDeleteEntity()
}

function doDeleteEntity() {
  /*
   * This action runs through the mogoose security checks.  If it passes
   * all subsequent child deletion bypasses security checks, operating
   * directly on the mongo connnection.
   *
   * Always delete the entity first so pre 'remove' logic runs while
   * links still exist and we can tickle activityDate for beacons and
   * entities this entity is linked to.
   */
  gdb.models['entities'].findOne({_id:entityId}, function(err, doc) {
    if (err) return res.sendErr(err)
    if (!doc) return res.sendErr(httpErr.notFound)
    doc.__user = req.user
    doc.remove(function(err) {
      if (err) return res.sendErr(err)
      handleChildren()
    })
  })
}

/*
 * Delete the children of an entity, bypassing mongoose security
 * The only security check is on the calling method, doDeleteEntity
 */
function handleChildren() {
  if (req.body.deleteChildren && req.body.deleteChildren === true) {
    var query = {toTableId:2, fromTableId:2, _to:entityId}
    db.collection('links').find(query).toArray(function(err, links) {
      if (err) return res.sendErr(err)
      var childIds = []
      for (var i = links.length; i--;) {
        childIds.push(links[i]._from)
      }
      db.collection('entities').remove({_id:{$in:childIds}}, {safe:true}, function(err) {
        if (err) return res.sendErr(err)
        updateActivityDateSynch()
      })
    })
  }
  else {
    updateActivityDateSynch()
  }
}

function updateActivityDateSynch() {
  /*
   * We need to update activity dates for first degree linked objects
   * before moving on because the links are going to be deleted.
   */
  if (req.body.skipActivityDate) {
    deleteObservations()
  }
  else {
    db.collection('links').find({ _from:entityId }).toArray(function(err, links) {
      if (err) {
        util.logErr('Find failed in updateActivityDateSynch')
        deleteObservations()
      }

      for (var i = links.length; i--;) {
        links[i].toTableId == 2 ? activityEntityIds.push(links[i]._to) : activityBeaconIds.push(links[i]._to)
      }

      /* 
       * Update activityDate for all beacons in the beaconId array 
       * TODO: Should we perform window checking to prevent hotspots like we are in propagateActivityDate
       */
      db.collection('beacons').update({ _id:{ $in:activityBeaconIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
        if (err) {
          util.logErr('Beacons update failed in updateActivityDateSynch')
          deleteObservations()
        }
        log('Updated activityDate for beacons: ' + activityBeaconIds)
        db.collection('entities').update({ _id:{ $in:activityEntityIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
          if (err) {
            util.logErr('Entities update failed in updateActivityDateSynch')
          }
          log('Updated activityDate for entities: ' + activityEntityIds)
          deleteObservations()
        })
      })
    })
  }
}

function deleteObservations() {
  db.collection('observations').remove({_entity:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    deleteLinksFrom()
  })
}


function deleteLinksFrom() {
  db.collection('links').remove({_from:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    deleteLinksTo()
  })
}

function deleteLinksTo() {
  db.collection('links').remove({_to:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    updateActivityDate()
  })
}

function updateActivityDate() {
  /*
   * Finish activity date updates for any second degree entities
   */
  if (!req.body.skipActivityDate) {
    for (var i = activityEntityIds.length; i--;) {
      methods.propogateActivityDate(activityEntityIds[i], activityDate)
    }
  }
  done()
}

function done() {
  res.send({
    info: 'Entity deleted',
    count: 1,
    data: {_id: entityId}
  })
}
