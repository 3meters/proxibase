/**
 * updateEntity
 */

var db = util.db
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entity:             { type: 'object', required: true, value: {
      _id:                { type: 'string', required: true },
      schema:             { type: 'string', required: true },
    }},
    includeRaw:         { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */  

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var activityDate = util.getTimeUTC()

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

    entity.activityDate = activityDate

    db[entityIdParsed.collectionName].findOne({_id: entityId}, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(perr.notFound())
      var options = { user:req.user }
      if (doc.locked) {
        if (req.user._id != util.adminUser._id && req.user._id != doc._owner) {
          return res.error(proxErr.locked())
        }
      }
      if (doc.schema === util.statics.schemaPlace) {
        if (doc._owner === util.adminUser._id || !entity.locked) {
          options = {asAdmin:true, user:req.user}
        }
      }

      updateEntity()

      function updateEntity() {
        log('updateEntity')
        db[entityIdParsed.collectionName].safeUpdate(entity, options, function(err, updatedEntity) {
          if (err) return res.error(err)
          if (!updatedEntity) return res.error(perr.notFound())
          if (!req.body.skipActivityDate) {
            methods.propogateActivityDate(entityId, activityDate) // Fire and forget
          }
          res.send({
            info: 'Entity updated',
            count: 1,
            data: updatedEntity,
            raw: req.raw,
          })
        })
      }
    })
  }
}
