/*
 * routes/do/deleteEntity.js
 *
 *   TODO: handle partial failure on handleChildren
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityId:               { type: 'string', required: true }, 
  skipActivityDate:       { type: 'boolean' },            
}

/* Request body template end =========================================== */

exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var options = util.clone(req.body)
  run(req, options, function(err, entityId, activityDate) {
      if (err) return res.error(err)
      res.send({
        info: 'Entity deleted',
        data: { _id: entityId },
        date: activityDate,
        count: 1,
      })      
  })
}

/* 
 * Internal method that can be called directly 
 *
 * No top level limiting is done in this method. It is assumed that the caller has already 
 * identified the desired set of entities and handled any limiting. 
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var activityDate = util.now()
  var err = util.check(options, _body)
  if (err) return cb(err)

  // set module vars
  var activityEntityIds = []
  var entityId = options.entityId
  var entityIdParsed = util.parseId(entityId)
  var adminModify = { user: req.user, asAdmin: true }
  var userModify =  req.user.developer ? adminModify : { user: req.user }

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
    db[entityIdParsed.collectionName].safeRemove({ _id: entityId }, userModify, function(err, count) {
      if (err) return done(err)
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
      if (err) return done(err)
      if (links.length == 0) return updateActivityDateSynch()

      /* Build collection of ids for entities that match the delete list */
      var deleteIds = []
      for (var i = links.length; i--;) {
        deleteIds.push(links[i]._from)
      }

      async.forEachSeries(deleteIds, deleteEntity, finish)        
      function deleteEntity(deleteId, next) {

        var deleteIdParsed = util.parseId(deleteId)
        db[deleteIdParsed.collectionName].safeRemove({ _id:deleteId }, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return done(err)
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
    if (options.skipActivityDate) {
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

    db.links.find({ _from:entityId }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish) 
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return done(err)
        deleteLinksTo()
      }
    })
  }

  function deleteLinksTo() {
    log('deleteLinksTo: ' + entityId)

    db.links.find({ _to:entityId }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish)
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return done(err)
        updateActivityDate()
      }
    })
  }

  function updateActivityDate() {
    /*
     * Finish activity date updates for any second degree entities
     */
    if (!options.skipActivityDate) {
      for (var i = activityEntityIds.length; i--;) {
        methods.propagateActivityDate(activityEntityIds[i], activityDate, false, false)
      }
    }
    done()
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, entityId, activityDate)
  }
}
