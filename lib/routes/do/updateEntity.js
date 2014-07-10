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

  function run(entity) {

    var updatedEntity

    var dbOps =  util.clone(req.dbOps)
    db[entityIdParsed.collectionName].safeFindOne({_id: entityId}, dbOps, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(perr.notFound())

      if (doc.locked) {
        if (req.user._id != util.adminId && req.user._id != doc._owner) {
          return res.error(proxErr.locked())
        }
      }

      /* Jayma: SECURITY HOLE */
      if (req.user && req.user.developer) dbOps.asAdmin = true

      updateEntity()

      function updateEntity() {
        log('updateEntity')

        db[entityIdParsed.collectionName].safeUpdate(entity, dbOps, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())

          action.event = 'update_entity' + '_' + req.body.entity.schema
          action._user = req.user._id
          action._entity = entityId

          log('Logging action for entity update: ' + updatedDoc._id)
          methods.logAction(action) // don't wait for callback

          updatedEntity = updatedDoc

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
