/*
 * updateEntity
 *   //TODO: Write tests:  all the custom method tests passed *before* this 
 *   file had been converted to get rid of mongoose.
 */

var db = util.db
var methods = require('./methods')
var _body = {entity: {required: true, type: 'object'}}

module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var activityDate = util.getTimeUTC()
  var entityId = req.body.entity._id
  doUpdateEntity(req.body.entity)

  function doUpdateEntity(entity) {
    /*
     * Comments are handled in a validator on entities
     */
    entity.activityDate = activityDate
    /*
     * Wikipedia style: 
     *
     * If this is a place entity and it is owned by the system
     * then we allow anyone to edit it. To lock down editing, the entity
     * owner must be set to a real user (like the coffee shop owner).
     * 
     * To really take this on, we may need a way to resolve editing 
     * conflicts. Wikipedia presents a diff when a conflict is detected
     * and the last saver must choose whether to overwrite, merge, revert, etc.
     */
    db.entities.findOne({ _id:entityId }, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(perr.notFound())

      var options = {user:req.user}
      if (entity.type === methods.statics.typePlace) {
        if (doc._owner === util.adminUser._id || !entity.locked) {
          options = {asAdmin:true, user:req.user}
          log('Editing entity as admin')
        }
      }

      db.entities.safeUpdate(entity, options, function(err, updatedEntity) {
        if (err) return res.error(err)
        if (!updatedEntity) return res.error(perr.notFound())
        updateActivityDate()
      })

    })
  }

  function updateActivityDate() {
    if (!req.body.skipActivityDate) {
      /* Fire and forget */
      methods.propogateActivityDate(entityId, activityDate)
    }
    done()
  }

  function done() {
    res.send({
      info: 'Entity updated',
      count: 1,
      data: {_id: entityId}
    })
  }
}
