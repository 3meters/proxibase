/*
 * replaceEntitiesForEntity
 *
 * Sometimes we need to work with entities as a set. This method
 * defines a set based on link type and entity they are pointing 'to'.
 * It is a complete replace operation not a merge.
 *
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var thumbnail = require('../applinks/thumbnail')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:           { type: 'string', required: true },
    entities:           { type: 'array', required: true },
    schema:             { type: 'string', required: true },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  log('activityDate: ' + activityDate)
  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var entityIdParsed = util.parseId(req.body.entityId)
  if (!(entityIdParsed.collectionName == 'places' && req.body.schema == statics.schemaApplink)) {
    return res.error(perr.badAuth())
  }
  var entityIds = []
  var insertedEntities = []

  var adminModify = { user: req.user, asAdmin: true }
  var userModify =  { user: req.user }

  deleteLinks()

  function deleteLinks() {
    log('deleting links of schema ' + req.body.schema + ' for ' + req.body.entityId)

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
    log('deleteEntities')

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
    log('insertEntities')

    async.forEachSeries(req.body.entities, insertEntity, finish)

      function insertEntity(entity, next) {

        var collectionName = statics.schemas[entity.schema].collection
        if (!db[collectionName]) {
          return next(perr.badValue('Unknown entity schema: ', entity.schema))
        }

        if (entity.type == statics.typeWebsite && !entity.photo) {
          // Fire and forget the thumbnail generator
          thumbnail.get(entity, userModify, res, function(err, website) {
            log('website applink image ready: ' + website.photo.prefix)
            if (!req.body.skipActivityDate) {
              methods.propagateActivityDate(req.body.entityId, util.now(), true, false) // Fire and forget
            }
          })

          // Set the thumbnail url optimistically
          entity.photo = {
            prefix: thumbnail.getFileName(entity),
            source: 'aircandi'
          }
        }

        db[collectionName].safeInsert(entity, userModify, function (err, savedDoc) {
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
    log('insertLinks')

    async.forEachSeries(insertedEntities, insertLink, finish)

      function insertLink(entity, next) {

        var link = {
          _to: req.body.entityId,
          _from: entity._id,
          type: statics.typeContent,
          // schema: req.body.schema,
        }

        db.links.safeInsert(link, userModify, function(err, savedDoc) {
          if (err) return next(err)
          next()
        })
      }

    function finish(err) {
      if (err) return res.error(err)
      done()
    }
  }

  function done() {
    if (!req.body.skipActivityDate) {
      methods.propagateActivityDate(req.body.entityId, activityDate, true, false) // Fire and forget
    }
    res.send({
      info: 'Entities replaced',
      data: [],
      date: activityDate,
      count: 0,
    })
  }
}
