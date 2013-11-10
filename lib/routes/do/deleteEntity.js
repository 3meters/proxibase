/**
 * routes/do/deleteEntity.js
 *
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityId:               { type: 'string', required: true },
  skipActivityDate:       { type: 'boolean' },
  verbose:                { type: 'boolean' },
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
  var action = {}
  var err = util.check(options, _body)
  if (err) return cb(err)

  // set module vars
  var entityId = options.entityId
  var entityIdParsed = util.parseId(entityId)
  var adminModify = { user: req.user, asAdmin: true }
  var userModify =  req.user.developer ? adminModify : { user: req.user }
  var verbose = options.verbose
  var deleteIds = []

  doDeleteEntity()

  function doDeleteEntity() {

    db[entityIdParsed.collectionName].safeRemove({ _id: entityId }, userModify, function(err, meta) {
      if (err) return done(err)
      if (!meta.count) return done(proxErr.notFound())
      /*
       * We add the primary entity to the delete ids even though it has already been
       * deleted so that it will get the standard link cleanup. The linked entity delete
       * sequence will try to delete it again but we ignore the failure and continue.
       */
      deleteIds.push(entityId)

      log('Logging action for entity delete: ' + entityId)
      action.event = 'delete_entity' + '_' + entityIdParsed.schemaName
      action._user = req.user._id
      action._entity = entityId
      methods.logAction(action)   // don't wait for callback

      deleteStrongLinkedEntities()
    })
  }

  /*
   *  Delete strong-linked entities
   */
  function deleteStrongLinkedEntities() {
    if (verbose) log('deleteStrongLinkedEntities for ', entityId)

    var query = _.extend(db.links.isStrongFilter(), { _to: entityId })

    db.links.find(query).toArray(function(err, links) {
      if (err) return done(err)
      if (links.length == 0) return done()

      /* Build collection of ids for entities that match the delete list */
      for (var i = links.length; i--;) {
        deleteIds.push(links[i]._from)
      }

      async.forEachSeries(deleteIds, deleteEntity, finish)

      function deleteEntity(deleteId, next) {
        var deleteIdParsed = util.parseId(deleteId)
        db[deleteIdParsed.collectionName].safeRemove({ _id:deleteId }, adminModify, function(err, meta) {
          if (err) return next(err)
          deleteLinksFrom(deleteId, next)
        })
      }

      function deleteLinksFrom(deleteId, next) {
        if (err) return next(err)
        if (verbose) log('deleteLinksFrom: ' + deleteId)

        db.links.find({ _from:deleteId }).toArray(function(err, links) {
          if (err) return next(err)

          async.forEachSeries(links, deleteLink, finish)

          function deleteLink(link, nextLink) {
            db.links.safeRemove({ _id:link._id }, adminModify, function(err, meta) {
              if (err) return nextLink(err)
              nextLink()
            })
          }

          function finish(err) {
            if (err) next(err)
            deleteLinksTo(deleteId, next)
          }
        })
      }

      function deleteLinksTo(deleteId, next) {
        if (err) return next(err)
        if (verbose) log('deleteLinksTo: ' + deleteId)

        db.links.find({ _to:deleteId }).toArray(function(err, links) {
          if (err) return next(err)

          async.forEachSeries(links, deleteLink, finish)

          function deleteLink(link, nextLink) {
            db.links.safeRemove({ _id:link._id }, adminModify, function(err, meta) {
              if (err) return nextLink(err)
              nextLink()
            })
          }

          function finish(err) {
            if (err) next(err)
            next()
          }
        })
      }

      function finish(err) {
        if (err) done(err)
        done()
      }
    })
  }


  function done(err) {
    if (err) logErr(err.stack || err)
    cb(err, entityId, activityDate)
  }
}
