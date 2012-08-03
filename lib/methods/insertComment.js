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
    return res.sendErr(new HttpErr(httpErr.missingParam, 'comment'))
  }

  if (!req.body.entityId) {
    return res.sendErr(new HttpErr(httpErr.missingParam, 'entityId'))
  }

  entityId = req.body.entityId
  doInsertComment()
}

function doInsertComment() {
  gdb.models['entities'].findOne({ _id:entityId }, function(err, entity) {
    if (err) return res.sendErr(err)
    if (!entity) res.sendErr(404)
    if (!entity.comments) entity.comments = []

    /*
     * Usually the base model takes care of system fields for us, but
     * comments are simply part of the entity schema and don't inherit
     * from base, thus we need to set these properties manually.
     * Snapshotting additional user information into the comment record
     * on insertion per Jayma design decision
     */
    req.body.comment._creator = req.user._id
    req.body.comment.createdDate = activityDate
    req.body.comment.name = req.user.name
    req.body.comment.location = req.user.location
    req.body.comment.imageUri = req.user.imageUri

    entity.comments.unshift(req.body.comment) /* inserts at top */
    entity.activityDate = activityDate
    entity.__user = req.user
    entity.__asAdmin = true  // because we we may be updating an entity record we don't own
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
