/*
 * updateEntity
 */

var
  util = require('../../util'),
  db = util.db,
  gdb = util.gdb,
  log = util.log,
  async = require('async'),
  methods = require('./methods'),
  req,
  res,
  entityId,
  activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()

  if (!(req.body && req.body.entity)) {
    return res.sendErr(new Error('request.body.entity is required'))
  }
  
  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("request.body.userId must be string type"))
  }

  entityId = req.body.entity._id
  doUpdateEntity(req.body.entity)
}

function doUpdateEntity(entity) {
  gdb.models['entities'].findOne({ _id: entity._id}, function (err, doc) {
    if (err) return res.sendErr(err)
    if (!doc) return res.sendErr(404)
    for (prop in entity) {
      doc[prop] = entity[prop]
    }
    doc.__user = req.user
    doc.activityDate = activityDate
    doc.save(function(err, updatedDoc) {
      if (err) return res.sendErr(err)
      if (!updatedDoc) {
        var err = new Error('Entity update failed for unknown reason for doc ' + entity._id + ' Call for help')
        log('Error ' + err.message)
        return res.sendErr(err, 500)
      }
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
