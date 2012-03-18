/*
/*
 * insertComment
 */

var
  db = require('../main').db,
  log = require('../util').log,
  getTimeUTC = require('../util').getTimeUTC,
  req,
  res

module.exports.main = function(request, response) {
  req = request
  res = response

  if (!(req.body && req.body.comment)) {
    return res.sendErr(new Error('request.body.comment is required'))
  }
  
  if (!(req.body && req.body.entityId)) {
    return res.sendErr(new Error('request.body.entityId is required'))
  }

  doInsertComment()
}

function doInsertComment() {
  db.collection('entities').findOne({ _id:req.body.entityId }, function(err, entity) {
    if (err) return res.sendErr(err)
    if (!entity) res.sendErr(404)
    req.body.comment.createdDate = getTimeUTC()
    if (!entity.comments) {
      entity.comments = []
    }
    entity.comments.unshift(req.body.comment) /* inserts at top */
    db.collection('entities').update({_id:entity._id}, entity, {safe:true}, function(err) {
      if (err) return sendErr(res, err)
      done()
    })
  })
}

function done() {
  res.send({
    info: 'Comment added to ' + req.body.entityId,
    count: 1
  })
}
