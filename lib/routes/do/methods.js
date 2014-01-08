/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */
var db = util.db
var gcm = require('node-gcm')
var async = require('async')
var tipe = require('tipe')

exports.logAction = function (action, cb) {
  if (tipe.isUndefined(cb)) cb = util.noop // callback is optional

  var _action = {
    event: { type: 'string', required: true },
    _user: { type: 'string', required: true },
    _entity: { type: 'string', required: true },
    _toEntity: { type: 'string' },
    _fromEntity: { type: 'string' },
  }

  var err = scrub(action, _action, {
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

exports.sendMessage = function (message, cb) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _message = {
    event:            { type: 'string', required: true }, // in/out: insert, update, delete, move, refresh
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

  var err = scrub(message, _message)

  if (err) {
    logErr('Invalid call to sendMessage: ', err.stack || err)
    return
  }

  /* Quick eliminations */
  if (!supportedMessage(message)) {
    log('Skipping unsupported message event')
    return
  }

  var registrationMap = {}
  var messages = []

  addMessageEntities()

  function addMessageEntities() {
    log('addMessageEntities')

    entityIds = []

    if (message.toId) entityIds.push(message.toId)
    if (message.fromId) entityIds.push(message.fromId)

    async.forEach(entityIds, process, finish)

    function process(entityId, next) {
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      var query = { _id: entityId, enabled: true }
      util.db[entityCollection].findOne(query, function(err, entity) {
        if (err) return next(err)

        if (message.toId === entity._id) message.toEntity = entity
        if (message.fromId === entity._id) message.fromEntity = entity
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)
      checkForNearbyMessages()
    }
  }

  /*
   * Look for users that are near the action user. We look for users that reported
   * recent visibility of one or more beacons in common with the action user. User beacons
   * are captured when their install is registered and when they execute proximity searches.
   */
  function checkForNearbyMessages() {
    log('Checking for nearby messages')
    /*
     * First check to see if there are any other installs around.
     * Criteria: last five minutes, and any of the beacons
     */
    if (!message.beaconIds) {
      checkForEntityCreateMessages()
    }
    else {
      var timeLimit = util.getTime() - 915000 // 15 minutes
      var query = {
        beacons: { $elemMatch: { $in: message.beaconIds }},
        beaconsDate: { $gte: timeLimit }
      }

      if (message.user) {
        query._user = { $ne: message.user._id }
      }

      debug('installs query', query)
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
   * picture, comment, candigram, etc.
   */
  function checkForEntityCreateMessages() {
    log('Checking for entity create messages')

    if (!message.toEntity) {
      checkForEntityWatchMessages()
    }
    else {
      /* Handle creator of the parent entity */
      relateUsersToEntity(message.toEntity._id, 'create', 'own_to', function(err) {
        if (err) {
          logErr('relateUsersToEntity failed in sendMessage: ', err.stack || err)
          return done(err)
        }

        /* Handle creator of the moved/expanded entity */
        if (message.event.indexOf('move') == 0 || message.event.indexOf('expand') == 0) {
          relateUsersToEntity(message.entity._id, 'create', 'own', function(err) {
            if (err) {
              logErr('relateUsersToEntity failed in sendMessage: ', err.stack || err)
              return done(err)
            }
            checkForEntityWatchMessages()
          })
        }
        else {
          checkForEntityWatchMessages()
        }
      })
    }
  }

  /*
   * Look for users that are watching the parent that is getting a new picture,
   * comment, candigram, etc. Or watching a candigram that is moving between places.
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

        /* Handle watch for the moved/expanded entity */
        if (message.event.indexOf('move') == 0 || message.event.indexOf('expand') == 0) {
          relateUsersToEntity(message.entity._id, 'watch', 'watch', function(err) {
            if (err) {
              logErr('relateUsersToEntity failed in sendMessage: ', err.stack || err)
              done(err)
            }
            checkForUserWatchMessages()
          })
        }
        else {
          checkForUserWatchMessages()
        }
      })
    }
  }

  /*
   * Look for users that are watching the action user who just did something
   * interesting like insert a picture, comment, like something, kick a candigram.
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

        util.db.installs.find({ _user: {$in: ids }}, { registrationId: true }).toArray(function (err, installs) {
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

      util.db.installs.find({ _user: {$in: ids }}, { registrationId: true, _user: true }).toArray(function (err, installs) {
        if (err) callback(err)
        if (!installs) callback()
        /*
         * If we already had an install registered for a nearby message, it will
         * be overridden by the watch message. 'Watch' is more explicit than 'nearby'
         * and we don't want to message the user twice about the same action.
         */
        for (var i = installs.length; i--;) {
          if (message.user && installs[i]._user != message.user._id) {
            log('install', installs[i])
            log('message.user', message.user)
            registrationMap[installs[i].registrationId] = trigger
          }
        }
        callback()
      })
    })
  }

  function finishMessage() {
    log('finishMessage')

    /* Nobody was registered for the message */
    if (!cb && Object.keys(registrationMap).length === 0) return

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
        name: message.user.name
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
      }
    }

    if (tipe.isObject(message.fromEntity)) {
      message_out.action.fromEntity = {
        id: message.fromEntity._id,
        name: message.fromEntity.name,
        photo: message.fromEntity.photo,
        category: message.fromEntity.category,
        schema: message.fromEntity.schema,
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
    if (message.entity.schema === util.statics.schemaPlace && message.event.indexOf('insert') == 0) return true
    if (message.entity.schema === util.statics.schemaPost && message.event.indexOf('insert') == 0) return true
    if (message.entity.schema === util.statics.schemaComment && message.event.indexOf('insert') == 0) return true
    if (message.entity.schema === util.statics.schemaCandigram && message.event.indexOf('insert') == 0) return true
    if (message.entity.schema === util.statics.schemaCandigram && message.event.indexOf('move') == 0) return true
    if (message.entity.schema === util.statics.schemaCandigram && message.event.indexOf('expand') == 0) return true
    return false
  }

  function done(err) {
    if (cb) {
      if (err) return cb(err)
      cb(null, messages)
    }
  }
}

var sendmessages = exports.sendmessages = function (message, registrationIds) {
  log('Sending ' + message.trigger + ' messages to ' + registrationIds.length + ' installs(s)')

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()

  message.sentDate = util.getTime()
  gcmMessage.addData('message', JSON.stringify(message))

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

