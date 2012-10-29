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

function doUpdateEntity(entity) {
  gdb.models.entities.findOne({ _id: entity._id}, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(404)
    for (prop in entity) {
      doc[prop] = entity[prop]
    }
    doc.__user = req.user
    doc.activityDate = activityDate
    doc.save(function(err, updatedDoc) {
      if (err) return res.error(err)
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
