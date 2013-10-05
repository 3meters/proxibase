/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */
var db = util.db
var gcm = require('node-gcm')

exports.logAction = function (action, cb) {
  if (type.isUndefined(cb)) cb = util.noop // callback is optional

  var _action = {
    _target: { type: 'string', required: true },
    type: { type: 'string', required: true },
    _user: { type: 'string', required: true },
  }

  var err = util.check(action, _action, {
    strict: true
  })

  if (err) {
    logErr('BUG: invalid call to logAction: ', err.stack || err)
    return cb(perr.serverError(err.message))
  }

  util.db.actions.safeInsert(action, { user: util.adminUser }, function (err, savedAction) {
    if (err) {
      util.logErr('Error inserting action', err)
      return cb(err)
    }
    cb(null, savedAction)
  })
}

exports.mapIdsByCollection = function (entityIds) {
  collectionMap = {}
  entityIds.forEach(function(entityId) {
    var entityIdParsed = util.parseId(entityId)
    if (entityIdParsed.collectionName) {
      collectionMap[entityIdParsed.collectionName] = collectionMap[entityIdParsed.collectionName] || []
      collectionMap[entityIdParsed.collectionName].push(entityId)
    }
  })
  return collectionMap
}

exports.notify = function (notification) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _notification = {
    action:       { type: 'string', required: true }, // in/out: insert, update, delete, move
    entity:       { type: 'object', required: true }, // in/out: action target
    user:         { type: 'object' },                 // in/out: user (if any) associated with the action

    toId:         { type: 'string' },                 // in: id of 'link to' or 'move to' entity if one
    fromId:       { type: 'string' },                 // in: id of 'move from' entity if one
    beaconIds:    { type: 'array' },                  // in: beacons associated with 'to' place (if one)

    toEntity:     { type: 'object' },                 // out: toId expanded
    fromEntity:   { type: 'object' },                 // out: fromId expanded
    typeTargetId: { type: 'string' },                 // out: entity id the action applies to
    type:         { type: 'string' },                 // out: local: watch, nearby
    title:        { type: 'string' },                 // out: local
    subtitle:     { type: 'string' },                 // out: local
    message:      { type: 'string' },                 // out: local
    sentDate:     { type: 'number' },                 // out: local
  }

  var err = util.check(notification, _notification)

  if (err) {
    logErr('Invalid call to notify: ', err.stack || err)
    return
  }

  if (notification.user && (notification.user._id === util.adminUser || notification.user._id === util.anonUser)) {
    delete notification.user
  }

  /* Quick eliminations */
  if (!supportedNotification(notification)) {
    log('Skipping unsupported notification type')
    return
  }

  var registrationMap = {}
  var toEntity
  var fromEntity

  checkForNearbyNotifications()

  /*
   * Look for users that are near the action user. We look for users that reported
   * recent visibility of one or more beacons in common with the action user. User beacons
   * are captured when their device is registered and when they execute proximity searches.
   */
  function checkForNearbyNotifications() {
    log('Checking for nearby notifications')
    /*
     * First check to see if there are any other devices around.
     * Criteria: last five minutes, and any of the beacons
     */
    if (!notification.beaconIds) {
      checkForEntityCreateNotifications()
    }
    else {
      var timeLimit = util.getTime() - 915000 // 15 minutes
      var query = {
        beacons: { $elemMatch: { $in: notification.beaconIds }},
        beaconsDate: { $gte: timeLimit }
      }

      if (notification.user) {
        query._user = { $ne: notification.user._id }
      }

      util.db.devices.find(query, { registrationId: true, _user: true }).toArray(function (err, devices) {
        if (err) {
          logErr('Find failed in notify: ', err.stack || err)
          return
        }
        for (var i = devices.length; i--;) {
          registrationMap[devices[i].registrationId] = 'nearby'
        }
        checkForEntityCreateNotifications()
      })
    }
  }

  /*
   * Look for the user that created the parent entity that is getting a new
   * picture, comment, candigram, etc.
   */
  function checkForEntityCreateNotifications() {
    log('Checking for entity create notifications')

    if (!notification.toId) {
      checkForEntityWatchNotifications()
    }
    else {
      /* Handle watch for the parent entity */
      relateUserToEntity(notification.toId, 'create', function(err, entity, type) {
        if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
        if (type) notification.typeTargetId = notification.toId
        toEntity = entity
        if (notification.action != 'move') {
          checkForEntityWatchNotifications()
        }
        else {
          /* Handle watch for the moved entity */
          relateUserToEntity(notification.entity._id, 'create', function(err, entity, type) {
            if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
            if (type) notification.typeTargetId = notification.entity._id
            if (!notification.fromId) {
              checkForEntityWatchNotifications()
            }
            else {
              relateUserToEntity(notification.fromId, 'create', function(err, entity, type) {
                if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
                if (type) notification.typeTargetId = notification.fromId
                fromEntity = entity
                checkForEntityWatchNotifications()
              })
            }
          })
        }
      })
    }
  }

  /*
   * Look for users that are watching the parent that is getting a new picture,
   * comment, candigram, etc.
   */
  function checkForEntityWatchNotifications() {
    log('Checking for entity watch notifications')

    if (!notification.toId) {
      checkForUserWatchNotifications()
    }
    else {
      /* Handle watch for the parent entity */
      relateUserToEntity(notification.toId, 'watch', function(err, entity, type) {
        if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
        if (type) notification.typeTargetId = notification.toId
        toEntity = entity
        if (notification.action != 'move') {
          checkForUserWatchNotifications()
        }
        else {
          /* Handle watch for the moved entity */
          relateUserToEntity(notification.entity._id, 'watch', function(err, entity, type) {
            if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
            if (type) notification.typeTargetId = notification.entity._id
            if (!notification.fromId) {
              checkForUserWatchNotifications()
            }
            else {
              relateUserToEntity(notification.fromId, 'watch', function(err, entity, type) {
                if (err) return logErr('relateUserToEntity failed in notify: ', err.stack || err)
                if (type) notification.typeTargetId = notification.fromId
                fromEntity = entity
                checkForUserWatchNotifications()
              })
            }
          })
        }
      })
    }
  }

  /*
   * Look for users that are watching the action user who just did something
   * interesting like insert a picture, comment, like something, kick a candigram.
   */
  function checkForUserWatchNotifications() {
    log('Checking for user watch notifications')

    if (!notification.user) {
      finishNotification()
    }
    else {

      /* Find the parent entity */
      var fields = { _id: true, name: true, _owner: true, type: true }
      var entityId = notification.user._id
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      util.db[entityCollection].findOne({ _id: entityId }, fields, function (err, doc) {
        if (err || !doc) {
          logErr('Find failed in notify: ', err.stack || err)
          return
        }
        util.db.links.find({ _to: entityId, fromCollectionId: 'us', type: 'watch' }).toArray(function (err, links) {
          if (err) {
            logErr('Find failed in notify: ', err.stack || err)
            return
          }
          var ids = []
          for (var i = links.length; i--;) {
            //if (links[i]._from !== notification.user._id) { // Skip so we don't self notify.
              ids.push(links[i]._from)
            //}
          }

          if (ids.length === 0) return finishNotification()

          util.db.devices.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, devices) {
            if (err) {
              logErr('Find failed in notify: ', err.stack || err)
              return
            }
            /*
             * If we already had a device registered for a nearby notification, it will
             * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
             * and we don't want to notify the user twice about the same action.
             */
            for (var i = devices.length; i--;) {
              registrationMap[devices[i].registrationId] = 'watch_user'
            }
            finishNotification()
          })
        })
      })
    }
  }

  function finishNotification() {

    if (Object.keys(registrationMap).length === 0) return

    /*
     * Include a compact version of the entity with the notification. We normalize
     * the property names because this isn't coming from storage.
     */
    if (notification.entity) {
      notification.entity = {
        id: notification.entity._id,
        name: notification.entity.name,
        description: notification.entity.description,
        category: notification.entity.category,
        photo: notification.entity.photo,
        ownerId: notification.entity._owner,
        schema: notification.entity.schema,
        type: notification.entity.type,
      }
    }

    /*
     * Include a compact version of the user with the notification. We normalize
     * the property names because this isn't coming from storage.
     */
    if (notification.user) {
      notification.user = {
        id: notification.user._id,
        photo: notification.user.photo,
        area: notification.user.area,
        name: notification.user.name
      }
    }

    delete notification.toId
    delete notification.beaconIds

    /*
     * We can provide a better message on the client if we have
     * the name of the parent entity (if one).
     */
    if (toEntity) {
      notification.toEntity = {
        id: toEntity._id,
        name: toEntity.name,
        photo: toEntity.photo,
        category: toEntity.category,
        schema: toEntity.schema,
      }
    }

    if (fromEntity) {
      notification.fromEntity = {
        id: fromEntity._id,
        name: fromEntity.name,
        photo: fromEntity.photo,
        category: fromEntity.category,
        schema: fromEntity.schema,
      }
    }
    /*
     * Owner notifications
     */
    var registrationIds = []
    for (var key in registrationMap) {
      if (registrationMap[key] === 'create') {
        registrationIds.push(key)
      }
    }

    if (registrationIds.length > 0) {
      notification.type = 'own'
      sendNotifications(notification, registrationIds)
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
      notification.type = 'watch'
      sendNotifications(notification, registrationIds)
    }

    /*
     * Watch user notifications
     */
    var registrationIds = []
    for (var key in registrationMap) {
      if (registrationMap[key] === 'watch_user') {
        registrationIds.push(key)
      }
    }

    if (registrationIds.length > 0) {
      notification.type = 'watch_user'
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
      notification.type = 'nearby'
      sendNotifications(notification, registrationIds)
    }
  }

  function supportedNotification(notification) {
    if (notification.entity.schema === util.statics.schemaPlace && notification.action === 'insert') return true
    if (notification.entity.schema === util.statics.schemaPost && notification.action === 'insert') return true
    if (notification.entity.schema === util.statics.schemaComment && notification.action === 'insert') return true
    if (notification.entity.schema === util.statics.schemaCandigram && notification.action === 'insert') return true
    if (notification.entity.schema === util.statics.schemaCandigram && notification.action === 'move') return true
    return false
  }

  function relateUserToEntity(entityId, relationship, callback) {
    var fields = { _id: true, name: true, _owner: true, type: true, schema: true, photo: true, category: true }
    var entityIdParsed = util.parseId(entityId)
    var entityCollection = entityIdParsed.collectionName
    var entity

    util.db[entityCollection].findOne({ _id: entityId }, fields, function (err, doc) {
      if (err || !doc) callback(err, null, null)

      entity = doc
      util.db.links.find({ _to: entityId, fromCollectionId: 'us', type: relationship }).toArray(function (err, links) {
        if (err) callback(err, null, null)
        if (!links) callback(null, entity, null)

        var ids = []
        for (var i = links.length; i--;) {
          ids.push(links[i]._from)
        }

        util.db.devices.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, devices) {
          if (err) callback(err, null, null)
          if (!devices) callback(null, entity, null)
          /*
           * If we already had a device registered for a nearby notification, it will
           * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
           * and we don't want to notify the user twice about the same action.
           */
          for (var i = devices.length; i--;) {
            registrationMap[devices[i].registrationId] = relationship
          }
          callback(null, entity, relationship)
        })
      })
    })
  }
}

var sendNotifications = exports.sendNotifications = function (notification, registrationIds) {
  log('Sending ' + notification.type + ' notifications to ' + registrationIds.length + ' device(s)')

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()
  notification.sentDate = util.getTime()
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
 * Handles insert and update cases. If inserting an entity, any strong links to entities
 * must already exist or we won't be able to find them. Because of special requirements,
 * delete cases are handled in the delete logic.
 */
var propagateActivityDate = module.exports.propagateActivityDate = function (entityId, activityDate, updateSelf, verbose) {

  if (!updateSelf) {
    propagate()
  }
  else {
    var entityIdParsed = util.parseId(entityId)
    util.db.collection(entityIdParsed.collectionName).findOne({ _id: entityId }, function(err, doc) {
      if (err || !doc) {
        util.logErr('propagateActivityDate: Find failed in updateSelf', err)
        return
      }
      doc.activityDate = activityDate
      util.db.collection(entityIdParsed.collectionName).update({ _id: doc._id }, doc, function(err) {
        if (err) {
          util.logErr('propagateActivityDate: Update failed in updateSelf', err)
          return
        }
        if (verbose) log('updated self activityDate for ' + entityIdParsed.collectionName + ': ' + doc._id)
        propagate()
      })
    })
  }

  /*
   * We traverse up all linked entities except specific exclusions and update their activityDate.
   * This is recursive so we will following a link chain until it ends.
   */
  function propagate() {

    var query = {
      _from: entityId,
      type: { $nin: ['like', 'create', 'watch', 'proximity']},
      inactive: false,
    }
    util.db.links.find(query).toArray(function (err, links) {
      if (err) {
        util.logErr('propagateActivityDate: Find failed in propagate', err)
        return
      }

      for (var i = links.length; i--;) {
        var cName = util.parseId(links[i]._to).collectionName
        util.db.collection(cName).findOne({ _id: links[i]._to }, function (err, doc) {
          if (err) {
            util.logErr('propagateActivityDate: Find failed in propagate', err)
            return
          }

          if (doc) {
            /*
             * If we need to deal with an update hotspot, we can add the following code to
             * not update activityDate if last update was less than activityDateWindow.
             * update if activityDate - doc.activityDate > util.statics.activityDateWindow
             */
            doc.activityDate = activityDate
            util.db.collection(cName).update({_id: doc._id}, doc, function(err) {
              if (err) {
                util.logErr('propagateActivityDate: Update failed in propagate', err)
                return
              }
              if (verbose) log('updated activityDate for ' + cName + ': ' + doc._id)
            })
            propagateActivityDate(doc._id, activityDate, false) // recurse
          }
        })
      }
    })
  }

}
