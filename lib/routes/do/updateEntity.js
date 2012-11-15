/*
 * updateEntity
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')
  , req
  , res
  , entityId
  , activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity'))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.error(proxErr.missingParam('userId type string'))
  }

  entityId = req.body.entity._id
  doUpdateEntity(req.body.entity)
}

function doUpdateEntity(entityUpdated) {

  /*
   * Using mongoskin direct until I can figure out how to update a nested document.
   * This means that none of the pre-save logic is getting processed like updating
   * the modifier and modifiedDate
   */
  db.collection('entities').findOne({ _id: entityUpdated._id}, function (err, entity) {
    if (err) return res.error(err)
    if (!entity) return res.error(404)

    for (prop in entityUpdated) {
      entity[prop] = entityUpdated[prop]
    }

    entity.activityDate = activityDate

    /*
     * Pre-save logic that normally gets run when we go thru mongoose
     */
    entity.namelc = entity.name.toLowerCase() // lower-case for case-insensitive find & sort
    entity.modifiedDate = util.getTimeUTC()
    entity._modifier = req.user._id

    db.collection('entities').update({_id:entityUpdated._id}, entity, {safe:true}, function(err) {
      if (err) return res.error(err)
      updateActivityDate()
    })
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
