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

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:           { type: 'string', required: true }, 
    entities:           { type: 'array', required: true },
    linkType:           { type: 'string', required: true },
    skipActivityDate:   { type: 'boolean' },
  }
  
  /* Request body template end ========================================= */

  var activityDate = util.now()  
  log('activityDate: ' + activityDate)
  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var entityIdParsed = util.parseId(req.body.entityId)
  var entityIds = []
  var insertedEntities = []

  deleteLinks()

  function deleteLinks() {
    log('deleting links of type ' + req.body.linkType + ' for ' + req.body.entityId)

    var options =  { user:req.user, asAdmin:true }

    var query = { 
      _to: req.body.entityId, 
      type: req.body.linkType,
    }
    db.links
      .find(query, { _from:true, _id:true })
      .toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish) 
      function deleteLink(link, next) {
        entityIds.push(link._from)
        db.links.safeRemove({_id:link._id}, options, function(err) {
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

    var options =  { user:req.user, asAdmin:true }

    async.forEachSeries(entityIds, deleteEntity, finish)   

      function deleteEntity(deleteId, next) {

        var deleteIdParsed = util.parseId(deleteId)
        db[deleteIdParsed.collectionName].safeRemove({ _id:deleteId }, options, function(err) {
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

    var options = { user: req.user }
    if (req.user && req.user.doNotTrack) {
      options.user = util.adminUser
    }

    async.forEachSeries(req.body.entities, insertEntity, finish) 

      function insertEntity(entity, next) {

        var collectionName = util.statics.collectionNameMap[entity.schema] 
        if (!db[collectionName]) {
          return next(perr.badValue('Unknown entity schema: ', entity.schema))
        }

        db[collectionName].safeInsert(entity, options, function (err, savedDoc) {
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

    var options = { user: req.user }

    async.forEachSeries(insertedEntities, insertLink, finish) 

      function insertLink(entity, next) {

        var link = { 
          _to: req.body.entityId, 
          _from: entity._id, 
          type: req.body.linkType,
          strong: true,
        } 

        db.links.safeInsert(link, options, function(err, savedDoc) {
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
      methods.propogateActivityDate(req.body.entityId, activityDate, true) // Fire and forget
    }
    res.send({
      info: 'Entities replaced',
      data: [],
      date: activityDate,
      count: 0,
    })
  }  
}
