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

  util.db.actions.safeInsert(action, { asAdmin: true, user: util.adminUser }, function (err, savedAction) {
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
    action:       { type: 'string', required: true }, // in/out: insert, update, delete
    entity:       { type: 'object', required: true }, // in/out: action target
    user:         { type: 'object', required: true }, // in/out: user associated with the action

    toId:         { type: 'string' },                 // in: id of 'link to' entity if one
    beaconIds:    { type: 'array' },                  // in: beacons near action user if some

    type:         { type: 'string' },                 // out: local: watch, nearby
    title:        { type: 'string' },                 // out: local
    subtitle:     { type: 'string' },                 // out: local
    message:      { type: 'string' },                 // out: local
    sentDate:     { type: 'number' },                 // out: local
  }

  var err = util.check(notification, _notification, { strict: true })

  if (err) {
    logErr('Invalid call to notify: ', err.stack || err)
    return
  }

  /* Quick eliminations */
  if (!supportedNotification(notification)) return

  var registrationMap = {}
  var toEntity

  checkForNearbyNotifications()

  function checkForNearbyNotifications() {
    log('Checking for nearby notifications')
    /* 
     * First check to see if there are any other devices around.
     * Criteria: last five minutes, and any of the beacons
     */
    if (!notification.beaconIds) return checkForWatchNotifications()

    var timeLimit = util.getTime() - 915000 // 15 minutes
    var query = { 
      beacons: { $elemMatch: { $in: notification.beaconIds }}, 
      _user: { $ne: notification.user._id }, 
      beaconsDate: { $gte: timeLimit }
    }

    util.db.devices.find(query, { registrationId: true, _user: true }).toArray(function (err, devices) {
      if (err) {
        logErr('Find failed in notify: ', err.stack || err)
        return
      }
      for (var i = devices.length; i--;) {
        registrationMap[devices[i].registrationId] = 'nearby'
      }
      checkForEntityWatchNotifications()
    })
  }

  function checkForEntityWatchNotifications() {
    log('Checking for entity watch notifications')

    if (!notification.toId) {
      checkForUserWatchNotifications()
    }
    else {

      /* Find the parent entity */
      var fields = { _id: true, name: true, _owner: true, type: true, schema: true, photo: true }
      var entityId = notification.toId
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      util.db[entityCollection].findOne({ _id: entityId }, fields, function (err, doc) {
        if (err || !doc) {
          logErr('Find failed in notify: ', err.stack || err)
          return
        }
        toEntity = doc
        util.db.links.find({ _to: entityId, fromCollectionId: 'us', type: 'watch' }).toArray(function (err, links) {
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

          if (ids.length === 0) return checkForUserWatchNotifications()

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
              registrationMap[devices[i].registrationId] = 'watch'
            }
            checkForUserWatchNotifications()
          })
        })
      })
    }
  }

  function checkForUserWatchNotifications() {
    log('Checking for user watch notifications')

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
          if (links[i]._from !== notification.user._id) { // Skip so we don't self notify.
            ids.push(links[i]._from)
          }
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
            registrationMap[devices[i].registrationId] = 'watch'
          }
          finishNotification()
        })
      })
    })
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
        toId: notification.toId,
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
        schema: toEntity.schema,
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
      notification.type = 'watch'
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
    return false
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
var propogateActivityDate = module.exports.propogateActivityDate = function (entityId, activityDate) {
  /*
   * We need to traverse to all strong linked entities and update their activityDate.
   */
  util.db.links.find({ _from:entityId, strong:true }).toArray(function (err, links) {
    if (err) {
      util.logErr('Find failed in propogateActivityDate', err)
      return
    }

    for (var i = links.length; i--;) {
      var cName = util.parseId(links[i]._to).collectionName
      util.db.collection(cName).findOne({ _id: links[i]._to }, function (err, doc) {
        if (err) {
          util.logErr('Find failed in propogateActivityDate', err)
          return
        }

        if (doc) {
          /* 
           * We don't update activityDate if last update was less than activityDateWindow
           */
          if (!doc.activityDate 
            || (doc.activityDate 
              && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {

            doc.activityDate = activityDate
            util.db.collection(cName).update({_id: doc._id}, doc, function(err) {
              if (err) {
                util.logErr('Update failed in propogateActivityDate', err)
                return
              }
              log('Updated activityDate for ' + cName + ': ' + doc._id)
            })
            propogateActivityDate(doc._id, activityDate) // recurse
          }
        }
      })
    }
  })
}
