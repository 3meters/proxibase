/*
 * insertComment
 */

var
  gdb = require('../main').gdb,
  log = require('../util').log,
  methods = require('./methods'),  
  util = require('../util'),
  req,
  res,
  entityId,
  activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()  

  if (!(req.body && req.body.comment)) {
    return res.sendErr(new Error('request.body.comment is required'))
  }

  if (!(req.body && req.body.entityId)) {
    return res.sendErr(new Error('request.body.entityId is required'))
  }

  entityId = req.body.entityId
  doInsertComment()
}

function doInsertComment() {
  gdb.models['entities'].findOne({ _id:entityId }, function(err, entity) {
    if (err) return res.sendErr(err)
    if (!entity) res.sendErr(404)
    req.body.comment.createdDate = activityDate
    if (!entity.comments) {
      entity.comments = []
    }
    entity.comments.unshift(req.body.comment) /* inserts at top */
    entity.activityDate = activityDate
    entity.__user = req.user
    entity.asAdmin = true
    entity.save(function(err) {
      if (err) return res.sendErr(err)
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
    info: 'Comment added to ' + req.body.entityId,
    count: 1
  }, 201)
}
