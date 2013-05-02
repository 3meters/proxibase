/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */
var db = util.db
var gcm = require('node-gcm')

/*
 * Statics
 */
module.exports.statics = {
  typePicture: 'com.aircandi.candi.picture',
  typePlace: 'com.aircandi.candi.place',
  typePost: 'com.aircandi.candi.post',
  typeLink: 'com.aircandi.candi.link',
  typeFolder: 'com.aircandi.candi.folder',
  typeCandigram: 'com.aircandi.candi.candigram',
}

// Return the distance between two points on the earth in meters
var haversine = module.exports.haversine = function (lat1, lng1, lat2, lng2) {

  var R = 6371000; // radius of earth = 6371km at equator

  // calculate delta in radians for latitudes and longitudes
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;

  // get the radians for lat1 and lat2
  var lat1rad = lat1 * Math.PI / 180;
  var lat2rad = lat2 * Math.PI / 180;

  // calculate the distance d
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
}

exports.logAction = function (action, cb) {
  if (type.isUndefined(cb)) cb = util.noop // callback is optional

  var _action = {
    _target: { type: 'string', required: true },
    targetSource: { type: 'string', required: true },
    type: { type: 'string', required: true },
    _user: { type: 'string', required: true },
    data: { type: 'object' },
  }

  var err = util.check(action, _action, {
    strict: true
  })

  if (err) {
    logErr('BUG: invalid call to logAction: ', err.stack || err)
    return cb(perr.serverError(err.message))
  }

  db.actions.safeInsert(action, { asAdmin: true, user: util.adminUser }, function (err, savedAction) {
    if (err) {
      util.logErr('Error inserting action', err)
      return cb(err)
    }
    cb(null, savedAction)
  })
}

exports.notify = function (notification) {
  /* 
   * Our important scenarios are proximity and watching.
   */
  var registrationMap = {}
  var _notification = {
    subject:      { type: 'string', required: true }, // entity, comment, user
    action:       { type: 'string', required: true }, // insert, update, delete
    user:         { type: 'object', required: true }, // user associated with the action
    entity:       { type: 'object', required: true }, // target entity
    parentId:     { type: 'string' },                 // id for parent of target entity
    beaconIds:    { type: 'array' },                  // beacons near action user
    comment:      { type: 'object' },                 // comment action applied to
    parentEntity: { type: 'object' },                 // parent of target entity
    type:         { type: 'string' },                 // local: watch, nearby
    title:        { type: 'string' },                 // local
    subtitle:     { type: 'string' },                 // local
    message:      { type: 'string' },                 // local
    sentDate:     { type: 'number' },                 // local
  }

  var err = util.check(notification, _notification, { strict: true })

  if (err) {
    logErr('Invalid call to notify: ', err.stack || err)
    return
  }

  /* Quick eliminations */
  if (!supportedNotification(notification)) return

  checkForNearbyNotifications(notification, registrationMap)

  function checkForNearbyNotifications(notification, registrationMap) {
    log('Checking for nearby notifications')
    /* 
     * First check to see if there are any other devices around.
     * Criteria: last five minutes, and any of the beacons
     */
    if (!notification.beaconIds) return checkForWatchNotifications(notification, registrationMap)

    var timeLimit = util.getTime() - 915000 // 15 minutes
    var query = { beacons: { $elemMatch: { $in: notification.beaconIds }}, _user: { $ne: notification.user._id }, beaconsDate: { $gte: timeLimit }}
    db.devices.find(query, { registrationId: true, _user: true }).toArray(function (err, devices) {
      if (err) {
        logErr('Find failed in notify: ', err.stack || err)
        return
      }
      for (var i = devices.length; i--;) {
        registrationMap[devices[i].registrationId] = 'nearby'
      }
      checkForWatchNotifications(notification, registrationMap)
    })
  }

  function checkForWatchNotifications(notification, registrationMap) {
    log('Checking for watch notifications')

    /* Find the parent entity */
    var fields = { _id: true, name: true, _owner: true, type: true }
    var entityId = notification.parentId ? notification.parentId : notification.entity._id
    db.entities.findOne({ _id: entityId }, fields, function (err, doc) {
      if (err || !doc) {
        logErr('Find failed in notify: ', err.stack || err)
        return
      }
      notification.parentEntity = doc
      db.links.find({ _to: doc._id, fromCollectionId: '0001', type: 'watch' }).toArray(function (err, links) {
        if (err) {
          logErr('Find failed in notify: ', err.stack || err)
          return
        }
        var ids = []
        for (var i = links.length; i--;) {
          if (links[i]._from !== notification.user._id) { // Skip so we don't self notify.
            ids.push(links[i]._from)
          }
        }

        if (ids.length === 0) return finishNotification(notification, registrationMap)

        db.devices.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, devices) {
          if (err) {
            logErr('Find failed in notify: ', err.stack || err)
            return
          }
          for (var i = devices.length; i--;) {
            registrationMap[devices[i].registrationId] = 'watch'
          }
          finishNotification(notification, registrationMap)
        })
      })
    })
  }

  function finishNotification(notification, registrationMap) {

    if (Object.keys(registrationMap).length === 0) return

    /* Additional configuration of the notification */
    if (notification.subject === 'entity') {
      notification.title = notification.user.name
    }
    else if (notification.subject === 'comment') {
      notification.title = notification.comment.name
      notification.message = notification.comment.description
    }

    notification.sentDate = util.getTime()
    if (notification.entity) {
      notification.entity = { 
        _id: notification.entity._id, 
        name: notification.entity.name, 
        _owner: notification.entity._owner, 
        type: notification.entity.type,
        _parent: notification.parentId,
      }
    }

    /* 
     * Watch notifications 
     */
    var registrationIds = []
    for (var key in registrationMap) {
      if (registrationMap[key] === 'watch') {
        registrationIds.push(key)
      }
    }

    if (registrationIds.length > 0) {
      if (notification.subject === 'entity') {
        subtitle = 'Added a candigram'
        if (notification.parentEntity && notification.parentEntity.name) subtitle += ' to "' + notification.parentEntity.name + '"'
      }
      else if (notification.subject === 'comment') {
        subtitle = 'Added a comment'
        if (notification.entity.name) subtitle += ' to "' + notification.entity.name + '"'
      }
      notification.subtitle = subtitle
      notification.type = 'watch'

      log('Sending watch notifications to ' + registrationIds.length + ' device(s)')
      log('Notification: ' + subtitle)
      log(notification)

      sendNotifications(notification, registrationIds)
    }

    /* 
     * Nearby notifications 
     */
    registrationIds = []
    for (var key in registrationMap) {
      if (registrationMap[key] === 'nearby') {
        registrationIds.push(key)
      }
    }

    if (registrationIds.length > 0) {
      if (notification.subject === 'entity') {
        if (notification.entity.type === 'com.aircandi.candi.place') {
          subtitle = 'Added a new place near you'
          if (notification.entity.name) subtitle += ' called "' + notification.entity.name + '"'
        }
        else {
          subtitle = 'Added a new candigram near you'
          if (notification.entity.name) subtitle += ' called "' + notification.entity.name + '"'
        }
      }
      else if (notification.subject === 'comment') {
        subtitle = 'Added a comment near you'
        if (notification.entity.name) subtitle += ' to "' + notification.entity.name + '"'
      }
      notification.subtitle = subtitle
      notification.type = 'nearby'

      log('Sending nearby notifications to ' + registrationIds.length + ' device(s)')
      log('Notification: ' + subtitle)
      log(notification)

      sendNotifications(notification, registrationIds)
    }
  }

  function supportedNotification(notification) {
    if (notification.subject === 'entity' && notification.action === 'insert') return true
    if (notification.subject === 'comment' && notification.action === 'insert') return true
    return false
  }
}

var sendNotifications = exports.sendNotifications = function (notification, registrationIds) {
  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()
  gcmMessage.addData('notification', JSON.stringify(notification))
  sender.send(gcmMessage, registrationIds, sendRetries, function (err, result) {
    if (err) {
      util.logErr('Error sending gcm message', err)
      return
    }
    log(result)
  });
}

/*
 * Handles insert and update cases. If inserting an entity, any links to beacons
 * and parent entities must already exist or we won't be able to find them.
 * Because of special requirements, delete cases are handled in the delete logic.
 */
var propogateActivityDate = module.exports.propogateActivityDate = function (entityId, activityDate) {
  /*
   * We need to traverse all links from this entity to
   * beacons or other entities and update their activityDate.
   */
  db.links.find({ _from: entityId }).toArray(function (err, links) {
    if (err) {
      util.logErr('Find failed in propogateActivityDate', err)
      return
    }

    for (var i = links.length; i--;) {
      var tableName = links[i].toCollectionId == 2 ? 'entities' : 'beacons'
      db.collection(tableName).findOne({ _id: links[i]._to }, function (err, doc) {
        if (err) {
          util.logErr('Find failed in propogateActivityDate', err)
          return
        }

        if (doc) {
          /* 
           * We don't update activityDate if last update was less than activityDateWindow
           */
          if (!doc.activityDate || (doc.activityDate && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {
            doc.activityDate = activityDate
            db.collection(tableName).update({ _id: doc._id }, doc, { safe: true }, function (err) {
              if (err) {
                util.logErr('Update failed in propogateActivityDate', err)
                return
              }
              log('Updated activityDate for ' + tableName + ': ' + doc._id)
            })
            if (tableName == 'entities') {
              propogateActivityDate(doc._id, activityDate) // recurse
            }
          }
        }
      })
    }
  })
}