/**
 * updateEntity
 */

var db = util.db
var methods = require('./methods')
var suggest = require('../applinks/suggest').run

// Validator template
var _body = {
  entity: {required: true, type: 'object', value: {
    _id: {type: 'string', required: true},
  }},
  refreshSources: {type: 'boolean'},
  skipActivityDate: {type: 'boolean'},
}

module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var activityDate = util.now()
  var entityId = req.body.entity._id
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
    db.entities.findOne({_id: entityId}, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(perr.notFound())
      var options = {user:req.user}
      if (doc.type === util.statics.typePlace) {
        if (doc._owner === util.adminUser._id || !entity.locked) {
          options = {asAdmin:true, user:req.user}
        }
      }

      if (doc.type === util.statics.typePlace
          && req.body.refreshSources) {
        // Call suggest sources
        var suggestOps = {
          entity: doc,
          user: req.user,
          newEntity: false,
          timeout: req.body.suggestTimeout,
          includeRaw: req.body.includeRaw,
        }
        suggest(suggestOps, function(err, newEnt, raw) {
          if (err) logErr(err)
          req.body.entity = newEnt
          if (raw) req.raw = raw
          updateEntity(req, res)
        })
      }
      else updateEntity()

      function updateEntity() {
        db.entities.safeUpdate(entity, options, function(err, updatedEntity) {
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
