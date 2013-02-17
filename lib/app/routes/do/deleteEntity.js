/*
 * routes/do/deleteEntity.js
 *
 *   TODO: handle partial failure on handleChildren
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

exports.main = function(req, res) {
  // set module vars
  var activityEntityIds = []
  var activityBeaconIds = []

  if (!(req.body && req.body.entityId)) {
    return res.error(proxErr.missingParam('entityId'))
  }

  var activityDate = util.getTimeUTC()
  var entityId = req.body.entityId
  doDeleteEntity(req, res)

  function doDeleteEntity(req, res) {
    /*
     * This action runs through the schema security checks.  If it passes
     * all subsequent child deletion bypasses security checks, operating
     * directly on the mongo connnection.
     *
     * Always delete the entity first so pre 'remove' logic runs while
     * links still exist and we can tickle activityDate for beacons and
     * entities this entity is linked to.
     */
    var options =  req.user.isDeveloper ? {user:req.user, asAdmin:true} : {user:req.user}
    db.entities.safeRemove({_id:entityId}, options, function(err, count) {
      if (err) return res.error(err)
      if (!count) return res.error(proxErr.notFound())
      handleChildren(req, res)
    })
  }

  /*
   * Delete the children of an entity, bypassing mongoose security
   * The only security check is on the calling method, doDeleteEntity
   * NOTE: Any triggers associated with document types will not be run !!!!
   */
  function handleChildren(req, res) {
    if (req.body.deleteChildren && req.body.deleteChildren === true) {
      var query = {toCollectionId:'0004', fromCollectionId:'0004', _to:entityId}
      db.links.find(query).toArray(function(err, links) {
        if (err) return res.error(err)

        var options =  {user:req.user, asAdmin:true}
        var childIds = []
        for (var i = links.length; i--;) {
          childIds.push(links[i]._from)
        }

        async.forEachSeries(childIds, deleteChild, finish)        
        function deleteChild(childId, next) {
          db.entities.safeRemove({_id:childId}, options, function(err) {
            if (err) return next(err)
            next()
          })
        }
        function finish(err) {
          if (err) return res.error(err)
          updateActivityDateSynch(req, res)
        }
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
      deleteLinksFrom(req, res)
    }
    else {
      db.links.find({ _from:entityId }).toArray(function(err, links) {
        if (err) {
          util.logErr('Find failed in updateActivityDateSynch')
          deleteLinksFrom(req, res)
        }

        for (var i = links.length; i--;) {
          links[i].toCollectionId == 2 ? activityEntityIds.push(links[i]._to) : activityBeaconIds.push(links[i]._to)
        }

        /* 
         * Update activityDate for all beacons in the beaconId array 
         * TODO: Should we perform window checking to prevent hotspots like we are in propagateActivityDate
         */
        db.beacons.update({ _id:{ $in:activityBeaconIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
          if (err) {
            util.logErr('Beacons update failed in updateActivityDateSynch')
            deleteLinksFrom(req, res)
          }
          db.entities.update({ _id:{ $in:activityEntityIds }}, { $set: {activityDate:activityDate }}, {safe:true, multi:true}, function(err) {
            if (err) {
              util.logErr('Entities update failed in updateActivityDateSynch')
            }
            deleteLinksFrom(req, res)
          })
        })
      })
    }
  }

  function deleteLinksFrom(req, res) {
    var options =  {user:req.user, asAdmin:true}

    db.links.find({ _from:entityId }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish)
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, options, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return res.error(err)
        deleteLinksTo(req, res)
      }
    })
  }

  function deleteLinksTo(req, res) {
    var options =  {user:req.user, asAdmin:true}

    db.links.find({ _to:entityId }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish)
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, options, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return res.error(err)
        updateActivityDate(req, res)
      }
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
}
