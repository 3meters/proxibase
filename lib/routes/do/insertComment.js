/*
 * insertComment
 */

var db = util.db
var methods = require('./methods')

// request body template
var _body = {
  comment: {type: 'object', required: true},
  entityId: {type: 'string', required: true},
  skipNotifications: {type: 'boolean'},
}


module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)  

  req.activityDate = util.getTime()

  doInsertComment(req, res)
}

function doInsertComment(req, res) {
  /*
   * TODO: If we want to enforce locked on the server we need to modify the query
   * to allow a comment to be inserted by the owner even if it is locked.
   *
   * db.entities.findOne({_id: req.body.entityId, locked: {$ne: true}}, {_id: true}, function(err, foundEntity){
   */
  db.entities.findOne({_id: req.body.entityId}, {_id: true, name: true, _owner: true, type: true}, function(err, entity){
    if (err) return res.error(err)
    if (!entity) return res.error(perr.notFound())
    req.entity = entity
    /*
     * Usually the base model takes care of system fields for us, but
     * comments are simply part of the entity schema and don't inherit
     * from base, thus we need to set these properties manually.
     * Snapshotting additional user information into the comment record
     * on insertion per Jayma design decision
     */
    var comment = req.body.comment
    comment._creator = req.user._id
    comment.createdDate = req.activityDate
    comment.name = req.user.name
    comment.location = req.user.location
    req.comment = comment

    var update = {
      $push: {comments: comment},
      $set: {activityDate: req.activityDate}
    }
    // Not safUpdate on purpose: bypass validation
    db.entities.update({_id: req.body.entityId}, update, function(err) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
    })
  })
}

function updateActivityDate(req, res) {
  if (!req.body.skipActivityDate) {
    /* Fire and forget */
    methods.propogateActivityDate(req.body.entityId, req.activityDate)
  }
  sendNotification(req, res)
}

function sendNotification(req, res) {

  /* Jayma: repro crash bug by checking skipNotifications instead of req.body.skipNotifications */
  /* Skip if owned by system or if comment is by the owner */
  if (req.body.skipNotifications 
    || req.entity._owner === util.adminUser._id 
    || req.entity._owner === req.user._id) {
    return done(req, res)
  }

  var subtitle = 'Added a comment'
  if (req.entity.name) subtitle += ' to "' + req.entity.name + '"'

  var notification = {
    type: 'comment',
    title: req.comment.name,
    subtitle: subtitle,
    message: req.comment.description,
    comment: req.comment,
    entity: req.entity,
    user: req.user
  }

  db.devices.find({ _user: req.entity._owner }, { registrationId: true }).toArray(function(err, devices) {
    if (err) return res.error(err)

    if (devices.length !== 0) {
      log('Sending message to devices of owner: ' + req.entity._owner)

      var registrationIds = []
      for (var i = 0; i < devices.length; i++) {
        registrationIds.push(devices[i].registrationId)
      }

        /* Fire and forget */
      if (registrationIds.length > 0) {
        notification.sentDate = util.getTime()
        methods.sendNotifications(notification, registrationIds)
      }
    }

    done(req, res)
  })
}

function done(req, res) {
  res.send(201, {
    info: 'Comment added to ' + req.entity._id,
    count: 1
  })
}