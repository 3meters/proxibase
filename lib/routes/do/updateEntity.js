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

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity'))
  }

  var activityDate = util.getTimeUTC()
  var entityId = req.body.entity._id
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
