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
  if (req.body.skipNotifications) return done(req, res)
  checkForOwnerNotifications(req, res)
}

function checkForOwnerNotifications(req, res) {

  /* Jayma: repro crash bug by checking skipNotifications instead of req.body.skipNotifications */
  /* Skip if owned by system or if comment is by the owner */
  log('Checking for owner notifications')
  var registrationMap = {}
  if (req.entity._owner === util.adminUser._id || req.entity._owner === req.user._id) {
    checkForWatchNotifications(req, res)
  }
  else {
    db.devices.find({ _user: req.entity._owner }, { registrationId: true }).toArray(function(err, devices) {
      if (err) return res.error(err)

      log('Sending message to devices of owner: ' + req.entity._owner)

      for (var i = 0; i < devices.length; i++) {
        registrationMap[devices[i].registrationId] = devices[i].registrationId
      }

      /* Fire and forget */
      if (Object.keys(registrationMap).length > 0) {
        var subtitle = 'Added a comment'
        if (req.entity.name) subtitle += ' to "' + req.entity.name + '"'
        sendNotification(req, 'owner', subtitle, registrationMap)
      }
      checkForWatchNotifications(req, res)
    })
  }
}

function checkForWatchNotifications(req, res) {

  log('Checking for watch notifications')

  /* Find the owner of the parent entity */
  registrationMap = {}
  db.entities.findOne({ _id:req.body.entityId }, { _id: true, name: true, _owner: true }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(perr.notFound())

    db.links.find({ _to:doc._id, fromCollectionId:'0001', type:'watch' }).toArray(function(err, links) {
      if (err) return res.error(err)

      var ids = []
      for (var i = links.length; i--;) {
        if (links[i]._from !== req.user._id) { // Skip so we don't self notify.
          ids.push(links[i]._from)
        }
      }

      db.devices.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function(err, devices) {
        if (err) return res.error(err)

        for (var i = devices.length; i--;) {
          registrationMap[devices[i].registrationId] = devices[i].registrationId
        }

        if (Object.keys(registrationMap).length > 0) {
          var subtitle = 'Added a comment'
          if (req.entity.name) subtitle += ' to "' + req.entity.name + '"'
          sendNotification(req, 'watch', subtitle, registrationMap)
        }

        return done(req, res)        
      })
    })
  })
}

function done(req, res) {
  res.send(201, {
    info: 'Comment added to ' + req.entity._id,
    count: 1
  })
}

function sendNotification(req, subtype, subtitle, registrationMap) {
  var registrationIds = []
  for (var key in registrationMap) {
    registrationIds.push(registrationMap[key])
  }

  log('Sending notifications to ' + registrationIds.length + ' device(s)')
  log('Notification: ' + subtitle)

  var notification = {
    type: 'comment',
    subtype: subtype,
    title: req.comment.name,
    subtitle: subtitle,
    message: req.comment.description,
    comment: req.comment,
    entity: req.entity,
    user: req.user
  }

  if (req.body.parentId) {
    notification.entity._parent = req.body.parentId
  }

  /* Fire and forget */
  notification.sentDate = util.getTime()
  methods.sendNotifications(notification, registrationIds)
  return
}