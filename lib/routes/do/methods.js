/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */

var gcm = require('node-gcm')
var async = require('async')

exports.logAction = function(action, cb) {
  if (!tipe.isFunction(cb)) cb = util.noop // callback is optional

  var _action = {
    event: { type: 'string', required: true },
    _user: { type: 'string', required: true },
    _entity: { type: 'string', required: true },
    _toEntity: { type: 'string' },
    _place: { type: 'string' },
  }

  var err = scrub(action, _action, {strict: true})

  if (err) {
    logErr('BUG: invalid call to logAction: ', err.stack || err)
    return cb(perr.serverError(err.message))
  }

  db.actions.safeInsert(action, {user: util.adminUser}, function (err, savedAction) {
    if (err) {
      util.logErr('Error inserting action', err)
      return cb(err)
    }
    cb(null, savedAction)
  })
}

exports.mapIdsByCollection = function (entityIds) {
  var collectionMap = {}
  entityIds.forEach(function(entityId) {
    var entityIdParsed = util.parseId(entityId)
    if (entityIdParsed.collectionName) {
      collectionMap[entityIdParsed.collectionName] = collectionMap[entityIdParsed.collectionName] || []
      collectionMap[entityIdParsed.collectionName].push(entityId)
    }
  })
  return collectionMap
}

exports.sendMessage = function (message, cb) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _message = {
    event:            { type: 'string', required: true }, // in/out: insert, update, delete, refresh
    entity:           { type: 'object', required: true }, // in/out: focal entity
    user:             { type: 'object' },                 // in/out: user (if any) associated with the type action

    toId:             { type: 'string' },                 // in: id of 'link to' entity if one
    beaconIds:        { type: 'array' },                  // in: beacons associated with inserted place or 'to' place (if one)

    toEntity:         { type: 'object' },                 // out: toId expanded
    trigger:          { type: 'string' },                 // out: local: watch, nearby, own
    title:            { type: 'string' },                 // out: local
    subtitle:         { type: 'string' },                 // out: local
    message:          { type: 'string' },                 // out: local
    sentDate:         { type: 'number' },                 // out: local
  }

  var err = scrub(message, _message)

  if (err) {
    logErr('Invalid call to sendMessage: ', err.stack || err)
    return done(err)
  }

  var registrationMap = {}
  var messages = []

  addMessageEntities()

  function addMessageEntities() {
    log('addMessageEntities')

    var entityIds = []

    if (message.toId) entityIds.push(message.toId)

    async.each(entityIds, processEntity, finish)

    function processEntity(entityId, next) {
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      var query = { _id: entityId }
      util.db[entityCollection].findOne(query, function(err, entity) {
        if (err) return next(err)
        if (message.toId === entity._id) message.toEntity = entity
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)

      /* Quick eliminations */
      if (!supportedMessage(message)) {
        log('Skipping unsupported message event')
        return done()
      }
      else {
        checkForNearbyMessages()
      }
    }
  }

  /*
   * Look for users that are near the provided beacons. We look for users that reported
   * recent visibility of one or more beacons in common with the provided beacons. User beacons
   * are captured when their install is registered and when they execute proximity searches.
   *
   * Beacons ids should be associated with a patch that already exists or one
   * being dropped.
   *
   */
  function checkForNearbyMessages() {
    log('Checking for nearby messages')

    if (!message.beaconIds) {
      checkForEntityCreateMessages()
    }
    else {
      /*
       * First check to see if there are any other installs around.
       * Criteria: last fifteen minutes and any of the beacons
       */
      var timeLimit = util.getTime() - 915000 // 15 minutes
      var query = {
        registrationId: { $exists: true },
        beacons:        { $elemMatch: { $in: message.beaconIds }},
        beaconsDate:    { $gte: timeLimit }
      }

      if (message.user) {
        query._user = { $ne: message.user._id }
      }

      util.db.installs.find(query, { registrationId: true, _user: true }).toArray(function (err, installs) {
        if (err) {
          logErr('Find failed in sendMessage: ', err.stack || err)
          return done(err)
        }

        log('nearby candidates mapped: ' + installs.length)
        for (var i = installs.length; i--;) {
          registrationMap[installs[i].registrationId] = 'nearby'
        }
        checkForEntityCreateMessages()
      })
    }
  }

  /*
   * Look for the user that created the parent entity that is getting a new
   * picture, comment, message, etc.
   */
  function checkForEntityCreateMessages() {
    log('Checking for entity create messages')

    if (!message.toEntity) {
      checkForEntityWatchMessages()
    }
    else {
      /* Handle creator of the parent entity */
      var userIds = [message.toEntity._owner]
      findInstalls(userIds, 'own_to', function(err) {
        if (err) {
          logErr('findInstalls failed in sendMessage: ', err.stack || err)
          return done(err)
        }
        checkForEntityWatchMessages()
      })
    }
  }

  /*
   * Look for users that are watching the parent that is getting a new picture,
   * comment, message, etc.
   */
  function checkForEntityWatchMessages() {
    log('Checking for entity watch messages')

    if (!message.toEntity) {
      checkForUserWatchMessages()
    }
    else {
      /* Handle watch for the parent entity */
      relateUsersToEntity(message.toEntity._id, 'watch', 'watch_to', function(err) {
        if (err) {
          logErr('relateUsersToEntity failed in sendMessage: ', err.stack || err)
          return done(err)
        }

        checkForUserWatchMessages()
      })
    }
  }

  /*
   * Look for users that are watching the action user who just did something
   * interesting like insert a picture, comment, watch something.
   */
  function checkForUserWatchMessages() {
    log('Checking for user watch messages')

    if (!message.user) {
      finishMessage()
    }
    else {
      util.db.links.find({ _to: message.user._id, fromSchema: 'user', type: 'watch' }).toArray(function (err, links) {
        if (err) {
          logErr('Find failed in sendMessage: ', err.stack || err)
          return done(err)
        }

        if (links.length === 0) return finishMessage()

        var ids = []
        for (var i = links.length; i--;) {
          ids.push(links[i]._from)
        }

        var query = {
          registrationId: { $exists: true },
          _user: {$in: ids },
        }

        util.db.installs.find(query, { registrationId: true }).toArray(function (err, installs) {
          if (err) {
            logErr('Find failed in sendMessage: ', err.stack || err)
            return done(err)
          }
          /*
           * If we already had an install registered for a nearby message, it will
           * be overridden by the watch message. 'Watch' is more explicit than 'nearby'
           * and we don't want to message the user twice about the same action.
           */
          log('watch_user candidates mapped: ' + installs.length)
          for (var i = installs.length; i--;) {
            registrationMap[installs[i].registrationId] = 'watch_user'
          }
          finishMessage()
        })
      })
    }
  }

  function finishMessage() {
    log('finishMessage')

    /* Nobody was registered for the message */
    if (!cb && Object.keys(registrationMap).length === 0) return done()

    /*
     * Include a compact version of the entity with the message. We normalize
     * the property names because this isn't coming from storage.
     */
    var message_out = {
      action: {
        event: message.event
      }
    }

    if (tipe.isObject(message.entity)) {
      message_out.action.entity = {
        id: message.entity._id,
        name: message.entity.name,
        description: message.entity.description,
        category: message.entity.category,
        photo: message.entity.photo,
        ownerId: message.entity._owner,
        schema: message.entity.schema,
        type: message.entity.type,
        modifiedDate: message.entity.modifiedDate,
        placeId: message.entity._place,
      }
    }

    /*
     * Include a compact version of the user with the message. We normalize
     * the property names because this isn't coming from storage.
     */
    if (tipe.isObject(message.user)) {
      message_out.action.user = {
        id: message.user._id,
        photo: message.user.photo,
        area: message.user.area,
        name: message.user.name,
        schema: statics.schemaUser,
      }
    }

    /*
     * We can provide a better message on the client if we have
     * the name of the parent entity (if one).
     */
    if (tipe.isObject(message.toEntity)) {
      message_out.action.toEntity = {
        id: message.toEntity._id,
        name: message.toEntity.name,
        photo: message.toEntity.photo,
        category: message.toEntity.category,
        schema: message.toEntity.schema,
        type: message.toEntity.type,
        placeId: message.toEntity._place,
      }
    }

    /*
     * Check for basic completeness
     */
    if (!(message_out.action
        && message_out.action.event
        && message_out.action.user
        && message_out.action.entity)) {
      logErr('message is incomplete, send cancelled: ', message_out)
      return done()
    }

    if (cb && Object.keys(registrationMap).length === 0) {
      message_out.info = 'message constructed but no triggers identified'
      messages.push(message_out)
      log(message_out.info)
      return done()
    }

    log('active registration map:', registrationMap)
    var triggers = ['nearby', 'own', 'own_to', 'watch', 'watch_to', 'watch_user']

    triggers.forEach(function(trigger) {
      var registrationIds = []
      var test_registration = false
      for (var key in registrationMap) {
        if (registrationMap[key] === trigger) {
          registrationIds.push(key)
          if (key.indexOf('testing') > 0) {
            test_registration = true
          }
        }
      }
      if (registrationIds.length > 0) {
        var message_hit = util.clone(message_out)
        message_hit.trigger = trigger
        messages.push(message_hit)
        if (test_registration) {
          message_hit.registrationIds = registrationIds
        }
        else {
          sendmessages(message_hit, registrationIds)
        }
      }
    })

    done()
  }

  function supportedMessage(message) {
    /*
     * Should have the entity and toEntity objects.
     */
    if (message.entity.schema === statics.schemaPlace && message.event.indexOf('insert') === 0) return true
    if (message.entity.schema === statics.schemaPost && message.event.indexOf('insert') === 0) return true
    if (message.entity.schema === statics.schemaComment && message.event.indexOf('insert') === 0) return true
    if (message.entity.schema === statics.schemaMessage) {
      if (message.event.indexOf('insert') === 0) {
        if (message.entity.type === statics.typeShare
            && message.toEntity && message.toEntity.schema === statics.schemaPlace) {
          return false
        }
        return true
      }
    }
    return false
  }

  function done(err) {
    if (cb) {
      if (err) return cb(err)
      cb(null, messages)
    }
  }

  /* Utility function */
  function relateUsersToEntity(entityId, triggerCategory, trigger, callback) {

    /* Relate using links */
    util.db.links.find({ _to: entityId, fromSchema: 'user', type: triggerCategory }).toArray(function (err, links) {
      if (err) callback(err)
      if (!links) callback()

      var ids = []
      for (var i = links.length; i--;) {
        ids.push(links[i]._from)
      }

      findInstalls(ids, trigger, callback)

    })
  }

  function findInstalls(userIds, trigger, callback) {
    var query = {
      registrationId: { $exists: true },
      _user: { $in: userIds },
    }

    util.db.installs.find(query, { registrationId: true, _user: true }).toArray(function (err, installs) {
      if (err) callback(err)
      if (!installs) callback()
      /*
       * If we already had an install registered for a nearby message, it will
       * be overridden by the watch message. 'Watch' is more explicit than 'nearby'
       * and we don't want to message the user twice about the same action.
       */
      log(trigger + ' candidates mapped: ' + installs.length)
      for (var i = installs.length; i--;) {
        if (message.user && installs[i]._user != message.user._id) {
          registrationMap[installs[i].registrationId] = trigger
        }
      }
      callback()
    })
  }
}

var sendmessages = exports.sendmessages = function (message, registrationIds) {
  /*
   * This gets called once for each trigger type that is active. It returns
   * immediately after the message has been passed off to the gcm sender.
   *
   * TODO: There is a limit of 1000 registration ids per call so we need to add chunking
   * support to handle more. We would hit that limit if there are 1000 people watching a patch or
   * 1000 Candipatch users near the same beacon.
   */
  log('Sending ' + message.trigger + ' messages to ' + registrationIds.length + ' installs(s)')

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()

  message.sentDate = util.getTime()
  gcmMessage.addData('message', JSON.stringify(message))

  sender.send(gcmMessage, registrationIds, sendRetries, function (err, result) {
    /*
     * By the time this returns, the calling function could be completely finished and gone.
     */
    if (err) {
      util.logErr('Error sending gcm message', err)
      return
    }
    /*
     * If aircandi has been uninstalled, we will get back a NotRegistered error
     * message from the GCM service. There are also other reasons we can get a
     * NotRegistered error.
     *
     * Note that it might take a while for the registration ID be completely removed from GCM. Thus
     * it is possible that messages sent to GCM get a valid message ID as response, even though the
     * message will not be delivered to the device. Eventually, the registration ID will be removed
     * and the server will get a NotRegistered error, without any further action being required from
     * the 3rd-party server (except to remove the install record).
     */
    log('result of gcm send: ', result)
    if (result && result.failure > 0) {

      var notRegisteredIds = []
      for (var i = 0; i < result.results.length; i++) {
        if (result.results[i].error && result.results[i].error === 'NotRegistered') {
          log('Unregistered id: ' + registrationIds[i])
          notRegisteredIds.push(registrationIds[i])
        }
      }

      async.each(notRegisteredIds, processId, finish)
    }
  })

  function processId(notRegisteredId, next) {

    /* This is done with super permissions and should not effect the modifedDate. */
    util.db.installs.update(
      { registrationId: notRegisteredId},
      { $unset: { registrationId: '' }},
      { safe: true, multi: false },
      function(err) {
        if (err) return next(err)
        next()
    })
  }

  function finish(err) {
    if (err) {
      util.logErr('Error clearing registrationId', err)
      return
    }
  }
}

