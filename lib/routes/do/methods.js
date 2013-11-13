/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */
var db = util.db
var gcm = require('node-gcm')
var async = require('async')

exports.logAction = function (action, cb) {
  if (type.isUndefined(cb)) cb = util.noop // callback is optional

  var _action = {
    event: { type: 'string', required: true },
    _user: { type: 'string', required: true },
    _entity: { type: 'string', required: true },
    _toEntity: { type: 'string' },
    _fromEntity: { type: 'string' },
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

exports.notify = function (notification, cb) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _notification = {
    type:             { type: 'string', required: true }, // in/out: insert, update, delete, move, refresh
    entity:           { type: 'object', required: true }, // in/out: focal entity
    user:             { type: 'object' },                 // in/out: user (if any) associated with the type action

    toId:             { type: 'string' },                 // in: id of 'link to' or 'move to' entity if one
    fromId:           { type: 'string' },                 // in: id of 'move from' entity if one
    beaconIds:        { type: 'array' },                  // in: beacons associated with 'to' place (if one)

    toEntity:         { type: 'object' },                 // out: toId expanded
    fromEntity:       { type: 'object' },                 // out: fromId expanded
    trigger:          { type: 'string' },                 // out: local: watch, nearby, own
    title:            { type: 'string' },                 // out: local
    subtitle:         { type: 'string' },                 // out: local
    message:          { type: 'string' },                 // out: local
    sentDate:         { type: 'number' },                 // out: local
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
    log('Skipping unsupported notification event')
    return
  }

  var registrationMap = {}
  var notifications = []

  addNotificationEntities()

  function addNotificationEntities() {
    log('addNotificationEntities')

    entityIds = []

    if (notification.toId) entityIds.push(notification.toId)
    if (notification.fromId) entityIds.push(notification.fromId)

    async.forEach(entityIds, process, finish)

    function process(entityId, next) {
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      var query = { _id: entityId, enabled: true }
      db[entityCollection].findOne(query, function(err, entity) {
        if (err) return next(err)

        if (notification.toId && notification.toId === entity.id) notification.toEntity = entity
        if (notification.fromId && notification.fromId === entity.id) notification.fromEntity = entity
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)
      checkForNearbyNotifications()
    }
  }

  /*
   * Look for users that are near the action user. We look for users that reported
   * recent visibility of one or more beacons in common with the action user. User beacons
   * are captured when their install is registered and when they execute proximity searches.
   */
  function checkForNearbyNotifications() {
    log('Checking for nearby notifications')
    /*
     * First check to see if there are any other installs around.
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

      util.db.installs.find(query, { registrationId: true, _user: true }).toArray(function (err, installs) {
        if (err) {
          logErr('Find failed in notify: ', err.stack || err)
          return done(err)
        }

        for (var i = installs.length; i--;) {
          registrationMap[installs[i].registrationId] = 'nearby'
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

    if (!notification.toEntity) {
      checkForEntityWatchNotifications()
    }
    else {
      /* Handle creator of the parent entity */
      relateUsersToEntity(notification.toEntity._id, 'create', 'own_to', function(err) {
        if (err) {
          logErr('relateUsersToEntity failed in notify: ', err.stack || err)
          return done(err)
        }

        /* Handle creator of the moved/expanded entity */
        if (notification.type === 'move' || notification.type === 'expand') {
          relateUsersToEntity(notification.entity._id, 'create', 'own', function(err) {
            if (err) {
              logErr('relateUsersToEntity failed in notify: ', err.stack || err)
              return done(err)
            }
            checkForEntityWatchNotifications()
          })
        }
        else {
          checkForEntityWatchNotifications()
        }
      })
    }
  }

  /*
   * Look for users that are watching the parent that is getting a new picture,
   * comment, candigram, etc. Or watching a candigram that is moving between places.
   */
  function checkForEntityWatchNotifications() {
    log('Checking for entity watch notifications')

    if (!notification.toEntity) {
      checkForUserWatchNotifications()
    }
    else {
      /* Handle watch for the parent entity */
      relateUsersToEntity(notification.toEntity._id, 'watch', 'watch_to', function(err) {
        if (err) {
          logErr('relateUsersToEntity failed in notify: ', err.stack || err)
          return done(err)
        }

        /* Handle watch for the moved/expanded entity */
        if (notification.type === 'move' || notification.type === 'expand') {
          relateUsersToEntity(notification.entity._id, 'watch', 'watch', function(err) {
            if (err) {
              logErr('relateUsersToEntity failed in notify: ', err.stack || err)
              done(err)
            }
            checkForUserWatchNotifications()
          })
        }
        else {
          checkForUserWatchNotifications()
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
      util.db.links.find({ _to: notification.user._id, fromSchema: 'users', type: 'watch' }).toArray(function (err, links) {
        if (err) {
          logErr('Find failed in notify: ', err.stack || err)
          return done(err)
        }

        if (links.length === 0) return finishNotification()

        var ids = []
        for (var i = links.length; i--;) {
          ids.push(links[i]._from)
        }

        util.db.installs.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, installs) {
          if (err) {
            logErr('Find failed in notify: ', err.stack || err)
            return done(err)
          }
          /*
           * If we already had an install registered for a nearby notification, it will
           * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
           * and we don't want to notify the user twice about the same action.
           */
          for (var i = installs.length; i--;) {
            registrationMap[installs[i].registrationId] = 'watch_user'
          }
          finishNotification()
        })
      })
    }
  }

  function relateUsersToEntity(entityId, triggerCategory, trigger, callback) {
    var fields = { _id: true, name: true, _owner: true, type: true, schema: true, photo: true, category: true }
    var entityIdParsed = util.parseId(entityId)
    var entityCollection = entityIdParsed.collectionName

    util.db.links.find({ _to: entityId, fromSchema: 'user', type: triggerCategory }).toArray(function (err, links) {
      if (err) callback(err)
      if (!links) callback()

      var ids = []
      for (var i = links.length; i--;) {
        ids.push(links[i]._from)
      }

      util.db.installs.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, installs) {
        if (err) callback(err)
        if (!installs) callback()
        /*
         * If we already had an install registered for a nearby notification, it will
         * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
         * and we don't want to notify the user twice about the same action.
         */
        for (var i = installs.length; i--;) {
          registrationMap[installs[i].registrationId] = trigger
        }
        callback()
      })
    })
  }

  function finishNotification() {
    log('finishNotification')

    /* Nobody was registered for the notification */
    if (!cb && Object.keys(registrationMap).length === 0) return

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
    delete notification.fromId
    delete notification.beaconIds

    /*
     * We can provide a better message on the client if we have
     * the name of the parent entity (if one).
     */
    if (notification.toEntity) {
      notification.toEntity = {
        id: toEntity._id,
        name: toEntity.name,
        photo: toEntity.photo,
        category: toEntity.category,
        schema: toEntity.schema,
      }
    }

    if (notification.fromEntity) {
      notification.fromEntity = {
        id: fromEntity._id,
        name: fromEntity.name,
        photo: fromEntity.photo,
        category: fromEntity.category,
        schema: fromEntity.schema,
      }
    }

    /*
     * Pull some properties into an action object.
     */
    notification.action = {
      event: notification.type,
      user: notification.user,
      entity: notification.entity,
      toEntity: notification.toEntity,
      fromEntity: notification.fromEntity,
    }

    delete notification.type
    delete notification.user
    delete notification.entity
    delete notification.toEntity
    delete notification.fromEntity

    /*
     * Check for completeness
     */
    if (!(notification.action
        && notification.action.event
        && notification.action.user
        && notification.action.entity)) {
      logErr('Notification is incomplete, send canceled: ', notification)
      return
    }

    if (cb && Object.keys(registrationMap).length === 0) {
      log('notification constructed but no registered install with valid triggers')
      notifications.push(notification)
      return done()
    }

    var triggers = ['nearby', 'own', 'own_to', 'watch', 'watch_to', 'watch_user']
    triggers.forEach(function(trigger) {
      var registrationIds = []
      for (var key in registrationMap) {
        if (registrationMap[key] === trigger) {
          registrationIds.push(key)
        }
      }
      if (registrationIds.length > 0) {
        notification.trigger = trigger
        notifications.push(notification)
        sendNotifications(notification, registrationIds)
      }
    })

    done()
  }

  function supportedNotification(notification) {
    if (notification.entity.schema === util.statics.schemaPlace && notification.type === 'insert') return true
    if (notification.entity.schema === util.statics.schemaPost && notification.type === 'insert') return true
    if (notification.entity.schema === util.statics.schemaComment && notification.type === 'insert') return true
    if (notification.entity.schema === util.statics.schemaCandigram && notification.type === 'insert') return true
    if (notification.entity.schema === util.statics.schemaCandigram && notification.type === 'move') return true
    if (notification.entity.schema === util.statics.schemaCandigram && notification.type === 'expand') return true
    return false
  }

  function done(err) {
    if (cb) {
      if (err) return cb(err)
      cb(null, notifications)
    }
  }
}

var sendNotifications = exports.sendNotifications = function (notification, registrationIds) {
  log('Sending ' + notification.trigger + ' notifications to ' + registrationIds.length + ' installs(s)')

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()

  notification.sentDate = util.getTime()
  gcmMessage.addData('activity', JSON.stringify(notification))

  sender.send(gcmMessage, registrationIds, sendRetries, function (err, result) {
    if (err) {
      util.logErr('Error sending gcm message', err)
      return
    }
    /*
     * TODO: If aircandi has been uninstalled, we will get back a NotRegistered error
     * message from the GCM service.
     *
     * Note that it might take a while for the registration ID be completely removed from GCM. Thus
     * it is possible that messages sent to GCM get a valid message ID as response, even though the
     * message will not be delivered to the device. Eventually, the registration ID will be removed
     * and the server will get a NotRegistered error, without any further action being required from
     * the 3rd-party server (except to remove the install record).
     */
    log(result)
  });
}

