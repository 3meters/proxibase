/*
 * replaceEntitiesForEntity
 *
 * Sometimes we need to work with entities as a set. This method
 * defines a set based on link type and entity they are pointing 'to'.
 * It is a complete replace operation not a merge.
 *
 * Note: Current logic only allows replacing applinks for a patch.
 */

var async = require('async')
var thumbnail = require('../applinks/thumbnail')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:           { type: 'string', required: true },
    entities:           { type: 'array', required: true },
    schema:             { type: 'string', required: true },
    activityDateWindow: { type: 'number' },
    verbose:            { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var err = util.scrub(req.body, _body)
  if (err) return res.error(err)

  var entityIdParsed = util.parseId(req.body.entityId)
  if (!(entityIdParsed.collectionName == 'patches' && req.body.schema == statics.schemaApplink)) {
    return res.error(perr.badAuth())
  }
  var entityIds = []
  var insertedEntities = []

  var adminModify = { user: req.user, asAdmin: true, tag: req.dbOps.tag}
  var userModify =  { user: req.user, tag: req.dbOps.tag }
  var patchOwner
  var entity

  if (tipe.isDefined(req.body.activityDateWindow)) {
    adminModify.activityDateWindow = req.body.activityDateWindow
    userModify.activityDateWindow = req.body.activityDateWindow
  }

  checkPerms()

  function checkPerms() {
    db.patches.safeFindOne({_id: req.body.entityId}, req.dbOps, function(err, patch) {
      if (err) return res.error(err)
      if (!patch) return res.error(perr.notFound())
      patchOwner = patch._owner
      entity = patch
      if (!patch.locked
          || util.adminId === patch._owner
          || req.user._id === patch._owner)
        return deleteLinks()
      res.error(perr.locked())
    })
  }

  function deleteLinks() {
    if (req.body.verbose) {
      log('deleting links of schema ' + req.body.schema + ' for ' + req.body.entityId)
    }

    var query = {
      _to: req.body.entityId,
      fromSchema: req.body.schema,
    }
    db.links
      .find(query, { _from:true, _id:true })
      .toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish)
      function deleteLink(link, next) {
        entityIds.push(link._from)
        db.links.safeRemove({ _id: link._id }, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }
      function finish(err) {
        if (err) return res.error(err)
        deleteEntities()
      }
    })
  }

  function deleteEntities() {

    async.forEachSeries(entityIds, deleteEntity, finish)

      function deleteEntity(deleteId, next) {

        var deleteIdParsed = util.parseId(deleteId)
        db[deleteIdParsed.collectionName].safeRemove({ _id: deleteId }, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }

    function finish(err) {
      if (err) return res.error(err)
      insertEntities()
    }
  }

  function insertEntities() {

    async.forEachSeries(req.body.entities, insertEntity, finish)

      function insertEntity(entity, next) {

        var collectionName = statics.schemas[entity.schema].collection
        if (!db[collectionName]) {
          return next(perr.badValue('Unknown entity schema: ', entity.schema))
        }

        entity._owner = patchOwner

        if (entity.type == statics.typeWebsite && !entity.photo) {
          // Fire and forget the thumbnail generator
          thumbnail.get(entity)

          // Set the thumbnail url optimistically
          entity.photo = {
            prefix: thumbnail.getFileName(entity),
            source: 'aircandi.thumbnails'
          }
        }

        db[collectionName].safeInsert(entity, adminModify, function (err, savedDoc) {
          if (err) return next(err)
          insertedEntities.push(savedDoc)
          next()
        })
      }

    function finish(err) {
      if (err) return res.error(err)
      insertLinks()
    }
  }

  function insertLinks() {

    async.forEachSeries(insertedEntities, insertLink, updatePatch)

      function insertLink(entity, next) {

        var link = {
          _to: req.body.entityId,
          _from: entity._id,
          type: statics.typeContent,
          _owner: patchOwner,
          // schema: req.body.schema,
        }

        db.links.safeInsert(link, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }
  }

  function updatePatch() {
    var patchUpdate = {
      _id: req.body.entityId,
      // Removing for now until we decide how applinks work in the era of patches
      // _applinkModifier: req.user._id
    }
    db.patches.safeUpdate(patchUpdate, adminModify, done)
  }


  function done(err) {
    if (err) return res.error(err)
    res.send({
      info: 'Entities replaced',
      data: [],
      date: activityDate,
      count: req.body.entities.length,
    })
  }
}
