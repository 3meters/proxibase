/*
 * routes/do/deleteEntity.js
 *
 *   TODO: handle partial failure on handleChildren
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:               { type: 'string', required: true }, 
    skipActivityDate:       { type: 'boolean' },            
  }
  
  /* Request body template end =========================================== */

  var activityDate = util.now()
  log('activityDate: ' + activityDate)
  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  // set module vars
  var activityEntityIds = []
  var entityId = req.body.entityId
  var entityIdParsed = util.parseId(entityId)

  doDeleteEntity()

  function doDeleteEntity() {
    /*
     * This action runs through the schema security checks.  If it passes
     * all subsequent child deletion bypasses security checks, operating
     * directly on the mongo connnection.
     *
     * Always delete the entity first so pre 'remove' logic runs while
     * links still exist and we can tickle activityDate for beacons and
     * entities this entity is linked to.
     */
    var options =  req.user.developer ? {user:req.user, asAdmin:true} : {user:req.user}
    db[entityIdParsed.collectionName].safeRemove({ _id:entityId }, options, function(err, count) {
      if (err) return res.error(err)
      if (!count) return res.error(proxErr.notFound())
      deleteStrongLinkedEntities()
    })
  }

  /*
   * Delete entities strong linked to the primary entity, bypassing mongoose security
   * The only security check is in the calling method, doDeleteEntity
   * NOTE: Any triggers associated with document types will not be run !!!!
   */
  function deleteStrongLinkedEntities() {
    log('deleteStrongLinkedEntities')

    var query = { _to:entityId, strong:true }
    db.links.find(query).toArray(function(err, links) {
      if (err) return res.error(err)
      if (links.length == 0) return updateActivityDateSynch()

      /* Build collection of ids for entities that match the delete list */
      var deleteIds = []
      for (var i = links.length; i--;) {
        deleteIds.push(links[i]._from)
      }

      async.forEachSeries(deleteIds, deleteEntity, finish)        
      function deleteEntity(deleteId, next) {

        var deleteIdParsed = util.parseId(deleteId)
        var options =  { user:req.user, asAdmin:true }
        db[deleteIdParsed.collectionName].safeRemove({ _id:deleteId }, options, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return res.error(err)
        updateActivityDateSynch()
      }

    })
  }

  function updateActivityDateSynch() {
    log('updateActivityDateSynch')
    /*
     * We need to update activity dates for first degree linked objects
     * before moving on because the links are going to be deleted.
     */
    if (req.body.skipActivityDate) {
      deleteLinksFrom()
    }
    else {
      var query = {
        _from: entityId, 
        type: { $nin: ['like', 'create', 'watch', 'proximity']},
        inactive: false,
      }      
      db.links.find(query).toArray(function(err, links) {
        if (err) {
          util.logErr('Find links failed in updateActivityDateSynch')
          deleteLinksFrom()
        }

        if (links.length == 0) {
          deleteLinksFrom()
        }
        else {
          log('links found: ' + links.length)
          for (var i = links.length; i--;) {
            activityEntityIds.push(links[i]._to)
          }
          /* 
           * Update activityDate for all entities in the activeEntityIds array 
           * TODO: Should we perform window checking to prevent hotspots like we are in propagateActivityDate
           */
          var collectionMap = methods.mapIdsByCollection(activityEntityIds)
          for (var collectionName in collectionMap) {
            var entityIds = collectionMap[collectionName]
            db[collectionName].update(
              { _id: { $in: entityIds }}, 
              { $set: { activityDate: activityDate }}, 
              { safe: true, multi: true }, 
              function(err) {
                if (err) util.logErr('Update ' + collectionName + ' failed in updateActivityDateSynch')
                deleteLinksFrom()
              }
            )
          }
        }
      })
    }
  }

  function deleteLinksFrom() {
    log('deleteLinksFrom: ' + entityId)
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
        deleteLinksTo()
      }

    })
  }

  function deleteLinksTo() {
    log('deleteLinksTo: ' + entityId)
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
        updateActivityDate()
      }

    })
  }

  function updateActivityDate() {
    /*
     * Finish activity date updates for any second degree entities
     */
    if (!req.body.skipActivityDate) {
      for (var i = activityEntityIds.length; i--;) {
        methods.propogateActivityDate(activityEntityIds[i], activityDate, false)
      }
    }
    done()
  }

  function done() {
    res.send({
      info: 'Entity deleted',
      count: 1,
      date: activityDate,
      data: {_id: entityId}
    })
  }
}
