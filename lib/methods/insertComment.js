/*
 * insertComment
 */

var
  db = require('../main').db,
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
  db.collection('entities').findOne({ _id:entityId }, function(err, entity) {
    if (err) return res.sendErr(err)
    if (!entity) res.sendErr(404)
    req.body.comment.createdDate = activityDate
    if (!entity.comments) {
      entity.comments = []
    }
    entity.comments.unshift(req.body.comment) /* inserts at top */
    entity.activityDate = activityDate
    db.collection('entities').update({_id:entity._id}, entity, {safe:true}, function(err) {
      if (err) return sendErr(res, err)
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
  })
}
