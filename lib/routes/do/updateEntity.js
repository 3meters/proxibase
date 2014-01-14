/**
 * updateEntity is true love
 */

var methods = require('./methods')
var getEntities = require('./getEntities').run

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entity:             { type: 'object', required: true, value: {
      _id:                { type: 'string', required: true },
      schema:             { type: 'string', required: true },
    }},
    includeRaw:         { type: 'boolean' },
    returnEntity:       { type: 'boolean', default: true },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var action = {}
  log('activityDate: ' + activityDate)
  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var entityId = req.body.entity._id
  var entityIdParsed = util.parseId(entityId)

  run(req.body.entity)
  /*
   * Wikipedia style permissions
   *
   * If this is a place entity and it is owned by the system
   * then we allow anyone to edit it. To lock down editing, the entity
   * owner must be set to a real user (like the coffee shop owner).
   *
   * To really take this on, we may need a way to resolve editing
   * conflicts. Wikipedia presents a diff when a conflict is detected
   * and the last saver must choose whether to overwrite, merge, revert, etc.
   *
   */
  function run(entity) {

    var updatedEntity

    db[entityIdParsed.collectionName].findOne({_id: entityId}, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(perr.notFound())
      var options = { user:req.user }

      if (doc.locked) {
        if (req.user._id != util.adminUser._id && req.user._id != doc._owner) {
          return res.error(proxErr.locked())
        }
      }

      updateEntity()

      function updateEntity() {
        log('updateEntity')
        db[entityIdParsed.collectionName].safeUpdate(entity, options, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())

          action.event = 'update_entity' + '_' + req.body.entity.schema
          action._user = req.user._id
          action._entity = entity._id

          log('Logging action for entity update: ' + updatedDoc._id)
          methods.logAction(action) // don't wait for callback

          updatedEntity = updatedDoc

          manageLinks()
        })
      }

      function manageLinks() {
        /*
         * So pictures, candigrams, etc will sort correctly when we are using just links and shortcuts.
         */
        log('synching modified date on links for: ' + entityId)
        var query = {
          _from: entityId,
          type: { $nin: ['like', 'create', 'watch', 'proximity']},
          inactive: false,
        }
        db.links.update(query, { $set: { modifiedDate: activityDate }}, { safe: true, multi: true }, function(err) {
            if (err) return res.error(err)
            getEntity()
        })
      }

      function getEntity() {
        /* Build and return the fully configured entity. */
        var response = {
          info: 'Entity updated',
          count: 1,
          date: activityDate,
          raw: req.raw,
        }

        if (!req.body.returnEntity) {
          response.data = { _id: updatedEntity._id }
          return res.send(response)
        }

        var options = {
          entityIds: [updatedEntity._id],
        }
        getEntities(req, options, function(err, entities) {
          if (err) return res.error(err)

          updatedEntity = entities[0]
          response.data = updatedEntity
          res.send(response)
        })
      }
    })
  }
}
