/*
 * updateEntity
 *   //TODO: Write tests:  all the custom method tests passed *before* this 
 *   file had been converted to get rid of mongoose.
 */

var util = require('util')
var db = util.db
var log = util.log
var methods = require('./methods')

module.exports.main = function(req, res) {
  var activityDate = util.getTimeUTC()
  var entityId

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity'))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.error(proxErr.missingParam('userId type string'))
  }

  entityId = req.body.entity._id
  doUpdateEntity(req.body.entity)

  function doUpdateEntity(entity) {

    /*
     * Comments are handled in a validator on entities
     */
    entity.activityDate = activityDate
    db.entities.safeUpdate(entity, {user:req.user}, function(err, updatedEntity) {
      if (err) return res.error(err)
      if (!updatedEntity) return res.error(404)
      updateActivityDate()
    })

    // gdb.models.entities.findOne({ _id: entityUpdated._id}, function (err, entity) {
    //   if (err) return res.error(err)
    //   if (!entity) return res.error(404)

    //   for (prop in entityUpdated) {
    //     entity[prop] = entityUpdated[prop]
    //   }

    //   entity.place.website = 'foo.com'

    //   entity.__user = req.user
    //   entity.activityDate = activityDate

    //   entity.save(function(err, updatedDoc) {
    //     if (err) return res.error(err)
    //     updateActivityDate()
    //   })
    // })
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
