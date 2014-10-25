/*
 * routes/do/push.js
 *
 * Push notification module
 */

var gcm = require('node-gcm')
var async = require('async')

exports.sendNotification = function (options, cb) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _options = {
    event:            { type: 'string', required: true },                         // event signature like 'insert_entity_message'
    triggers:         { type: 'array', default: ['nearby','own_to','watch_to'] }, // active triggers
    from:             { type: 'object' },                                         // optimize if from entity already available
    fromId:           { type: 'string' },                                         // id of 'link from' entity if one
    to:               { type: 'object' },                                         // optimize if to entity already available
    toId:             { type: 'string' },                                         // id of 'link to' entity if one
    link:             { type: 'object' },                                         // link if involved. event signature keys it's use
    beaconIds:        { type: 'array' },                                          // beacons associated with event to support nearby trigger
    blockedId:        { type: 'string' },                                         // user who should be excluded from notifications
  }

  var err = scrub(options, _options)

  if (err) {
    logErr('Invalid call to push: ', err)
    return done(err)
  }

  var registrationMap = {}
  var notifications = []

  log('options: ', options)

  addNotificationEntities()

  function addNotificationEntities() {
    log('addNotificationEntities')

    var entityIds = []

    if (!options.to && options.toId)
      entityIds.push(options.toId)
    if (!options.from && options.fromId)
      entityIds.push(options.fromId)

    async.each(entityIds, processEntity, finish)

    function processEntity(entityId, next) {
      var entityIdParsed = util.parseId(entityId)
      var entityCollection = entityIdParsed.collectionName

      var query = { _id: entityId }
      util.db[entityCollection].findOne(query, function(err, entity) {
        if (err) return next(err)
        if (options.toId === entity._id) options.to = entity
        if (options.fromId === entity._id) options.from = entity
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)

      /* Quick eliminations */
      if (!supportedNotification(options)) {
        log('Skipping unsupported notification event')
        return done()
      }
      else {
        checkForNearbyNotifications()
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
  function checkForNearbyNotifications() {

    if (options.triggers.indexOf('nearby') === -1
      || !options.beaconIds) {
      checkForEntityWatchNotifications()
    }
    else {
      log('Checking for nearby notifications')
      /*
       * First check to see if there are any other installs around.
       * Criteria: last fifteen minutes and any of the beacons
       */
      var timeLimit = util.getTime() - 915000 // 15 minutes
      var query = {
        registrationId: { $exists: true },
        beacons:        { $elemMatch: { $in: options.beaconIds }},
        beaconsDate:    { $gte: timeLimit }
      }

      util.db.installs.find(query, { registrationId: true, _user: true }).toArray(function (err, installs) {
        if (err) {
          logErr('Find failed in push: ', err)
          return done(err)
        }

        log('Nearby candidates mapped: ' + installs.length)
        for (var i = installs.length; i--;) {
          if (!options.blockedId || options.blockedId !== installs[i]._user) {
            registrationMap[installs[i].registrationId] = 'nearby'
          }
        }
        checkForEntityWatchNotifications()
      })
    }
  }

  /*
   * Look for users that are watching the parent that is getting
   * a new entity.
   */
  function checkForEntityWatchNotifications() {
    log('Checking for entity watch notifications')

    if (options.triggers.indexOf('watch_to') === -1 || !options.to) {
      checkForToEntityCreateNotifications()
    }
    else {
      /* Handle watch for the parent entity */
      relateUsersToEntity(options.to._id, 'watch', 'watch_to', function(err) {
        if (err) {
          logErr('relateUsersToEntity failed in push: ', err)
          return done(err)
        }

        checkForToEntityCreateNotifications()
      })
    }
  }

  /*
   * Look for the user that created the parent entity that is getting
   * a new entity. Owning trumps watching.
   */
  function checkForToEntityCreateNotifications() {
    log('Checking for [to] entity create notifications')

    if (options.triggers.indexOf('own_to') === -1 || !options.to) {
      checkForFromEntityCreateNotifications()
    }
    else {
      /* Handle creator of the parent entity */
      var userIds = [options.to._owner]
      findInstalls(userIds, 'own_to', function(err) {
        if (err) {
          logErr('findInstalls failed in push: ', err)
          return done(err)
        }
        checkForFromEntityCreateNotifications()
      })
    }
  }

  /*
   * Look for the user that created the parent entity that is getting
   * a new entity. Owning trumps watching.
   */
  function checkForFromEntityCreateNotifications() {
    log('Checking for [from] entity create notifications')

    if (options.triggers.indexOf('own_from') === -1 || !options.from) {
      finishNotification()
    }
    else {
      /* Handle creator of the child entity */
      var userIds = [options.from._owner]
      findInstalls(userIds, 'own_from', function(err) {
        if (err) {
          logErr('findInstalls failed in push: ', err)
          return done(err)
        }
        finishNotification()
      })
    }
  }

  /*
   * Assemble notification notifications.
   */
  function finishNotification() {
    log('finishNotification')

    /* Nobody was registered for the notification */
    if (Object.keys(registrationMap).length === 0) {
      if (cb) {
        notifications.push({
          info: 'notification constructed but no triggers identified',
        })
        log(notifications[0].info)
      }
      return done()
    }

    log('Active registration map:', registrationMap)

    options.triggers.forEach(function(trigger) {
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
        var params = {
          event: options.event,
          to: options.to,
          from: options.from,
          link: options.link,
          trigger: trigger,
        }
        var notification = buildNotification(params)
        notifications.push(notification)
        if (test_registration) {
          notification.registrationIds = registrationIds
        }
        else {
          sendnotifications(notification, registrationIds)
        }
      }
    })

    done()
  }

  function supportedNotification(options) {
    if (options.event.indexOf('watch_entity_place') === 0)
      return true
    if (options.event.indexOf('request_watch_entity') === 0)
      return true
    if (options.event.indexOf('approve_watch_entity') === 0)
      return true
    if (options.event.indexOf('insert_entity_place') === 0)
      return true
    if (options.event.indexOf('insert_entity_message') === 0) {
      if (options.event.indexOf('insert_entity_message_share') === 0) {
        if (options.to.schema === statics.schemaPlace) {
          return false
        }
      }
      return true
    }
  }

  function done(err) {
    if (cb) {
      if (err) return cb(err)
      cb(null, notifications)
    }
  }

  /* Utility function */
  function relateUsersToEntity(entityId, triggerCategory, trigger, callback) {

    /* Relate using links */
    util.db.links.find({ _to: entityId, fromSchema: 'user', type: triggerCategory, enabled: true }).toArray(function (err, links) {
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
       * If we already had an install registered for a nearby notification, it will
       * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
       * and we don't want to notification the user twice about the same action.
       */
      log(trigger + ' candidates mapped: ' + installs.length)
      for (var i = installs.length; i--;) {
        if (!options.blockedId || options.blockedId !== installs[i]._user) {
          registrationMap[installs[i].registrationId] = trigger
        }
      }
      callback()
    })
  }
}

var sendnotifications = exports.sendnotifications = function (notification, registrationIds) {
  /*
   * This gets called once for each trigger type that is active. It returns
   * immediately after the notification has been passed off to the gcm sender.
   *
   * TODO: There is a limit of 1000 registration ids per call so we need to add chunking
   * support to handle more. We would hit that limit if there are 1000 people watching a patch or
   * 1000 users near the same beacon.
   */
  log('Sending ' + notification.trigger + ' notifications to ' + registrationIds.length + ' installs(s)')

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()

  notification.sentDate = util.getTime()
  gcmMessage.addData('notification', JSON.stringify(notification))

  sender.send(gcmMessage, registrationIds, sendRetries, function (err, result) {
    /*
     * By the time this returns, the calling function could be completely finished and gone.
     */
    if (err) {
      util.logErr('Error sending gcm notification', err)
      return
    }
    /*
     * If aircandi has been uninstalled, we will get back a NotRegistered error
     * notification from the GCM service. There are also other reasons we can get a
     * NotRegistered error.
     *
     * Note that it might take a while for the registration ID be completely removed from GCM. Thus
     * it is possible that notifications sent to GCM get a valid notification ID as response, even though the
     * notification will not be delivered to the device. Eventually, the registration ID will be removed
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

var buildNotification = exports.buildNotification = function(options) {
  /*
   * For now we can always assume the alert is about
   * the status of a watch link so all the params are
   * required.
   *
   * Note: Very brittle in the face of schema changes.
   */
  var _options = {
    event:      { type: 'string', required: true },
    trigger:    { type: 'string', required: true },
    to:         { type: 'object', required: true },
    from:       { type: 'object' },
    link:       { type: 'object' },
  }

  var err = scrub(options, _options)

  if (err) {
    logErr('Invalid call to push.buildNotification: ', err)
    return err
  }
  /*
   * The notification has to provide enough context to be shown
   * in a list. Additional context can come from linked entities.
   */
  var admin = { _id: util.adminId, name: 'Patch' }
  var notification = {
    schema: 'notification',
    event: options.event,
    trigger: options.trigger,
    _creator: admin._id,
    _modifier: admin._id,
    creator: admin,
    modifier: admin,
    priority: 2,
  }

  if (options.event === 'watch_entity_place') {
    /*
     * [user] -> watch -> [place]
     */
    notification.type = 'watch'
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    var privacy = (options.to.visibility === 'public') ? 'public' : 'closed'
    if (options.trigger === 'own_to') {
      notification.subtitle = util.format('<b>%s</b> started watching your %s patch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.subtitle
    }
    else if (options.trigger === 'own_from') {
      notification.subtitle = util.format('You started watching %s patch <b>%s</b>', privacy, options.to.name)
    }
    else if (options.trigger === 'own_both') {
      notification.subtitle = util.format('You started watching your own %s patch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event === 'request_watch_entity') {
    /*
     * [user] -> watch -> [place]
     */
    notification.type = 'watch'
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    var privacy = (options.to.visibility === 'public') ? 'public' : 'closed'
    if (options.trigger === 'own_to') {
      notification.subtitle = util.format('<b>%s</b> has a pending request to join your %s patch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = util.format('<b>%s</b> wants to join your %s patch <b>%s</b>', options.from.name, privacy, options.to.name)
    }
    else if (options.trigger === 'own_from') {
      notification.subtitle = util.format('You sent a request to join %s patch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event === 'approve_watch_entity') {
    /*
     * [user] -> watch -> [place]
     */
    notification.type = 'watch'
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.to.creator._id

    var privacy = (options.to.visibility === 'public') ? 'public' : 'closed'
    if (options.trigger === 'own_to') {
      notification.subtitle = util.format('You approved the request by <b>%s</b> to join your %s patch <b>%s</b>', options.from.name, privacy, options.to.name)
    }
    else if (options.trigger === 'own_from') {
      notification.subtitle = util.format('<b>%s</b> approved your request to join %s patch <b>%s</b>', options.to.creator.name, privacy, options.to.name)
      notification.ticker = notification.subtitle
    }
    else if (options.trigger === 'own_both') {
      notification.subtitle = util.format('You started watching your own %s patch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event === 'insert_entity_place') {
    /*
     * [empty] -> empty -> [place]
     * [user] -> create -> [place]
     */
    notification.type = 'place'
    notification.id = 'no' + options.to._id.substring(2)
    notification._target = options.to._id
    notification.photo = options.to.creator.photo
    notification.photoBig = options.to.photo
    notification.createdDate = options.to.createdDate
    notification.modifiedDate = options.to.modifiedDate
    notification.sortDate = notification.createdDate // We don't want it changing sort position because of editing.
    notification.userId = options.to.creator._id

    var privacy = (options.to.visibility === 'public') ? 'public' : 'closed'
    if (options.trigger === 'nearby') {
      notification.subtitle = util.format('<b>%s</b> created the %s patch <b>%s</b> nearby', options.to.creator.name, privacy, options.to.name)
      notification.ticker = notification.subtitle
      notification.priority = 1
    }
    else if (options.trigger === 'own_both') {
      notification.subtitle = util.format('You created the %s patch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event.indexOf('insert_entity_message') === 0) {
    /*
     * [message[creator]] -> content -> [place]
     * [message[creator]] -> content -> [message]
     */
    notification.type = 'message'
    notification.id = 'no' + options.from._id.substring(2)
    notification._target = options.from._id
    notification._parent = options.to._id
    notification.photo = options.from.creator.photo
    notification.photoBig = options.from.photo
    notification.createdDate = options.from.createdDate
    notification.modifiedDate = options.from.modifiedDate
    notification.sortDate = notification.createdDate // We don't want it changing sort position because of editing.
    notification.ticker = 'Message from Patchr'

    if (options.event === 'insert_entity_message_share') {
      /*
       * [message[creator]] -> share -> [user]
       */
      notification.type = 'share'
      notification.userId = options.from.creator._id
      notification.trigger = 'share'
      if (options.from.photo) {
        notification.subtitle = util.format('<b>%s</b> shared a photo with you', options.from.creator.name)
        notification.ticker = notification.subtitle
      }
      else {
        notification.subtitle = util.format('<b>%s</b> shared with you: "%s"', options.from.creator.name, options.from.description)
        notification.ticker = notification.subtitle
      }
    }
    else {
      notification.userId = options.from.creator._id

      /* Reply to a message */
      if (options.to.schema === statics.schemaMessage) {
        if (options.to.place) {
          if (options.trigger === 'nearby') {
            notification.subtitle = util.format('<b>%s</b> replied to a message at nearby patch <b>%s</b>: "%s"', options.from.creator.name, options.to.place.name, options.from.description)
            notification.priority = 1
          }
          else if (options.trigger === 'watch_to') {
            notification.subtitle = util.format('<b>%s</b> replied to a message at patch <b>%s</b>: "%s"', options.from.creator.name, options.to.place.name, options.from.description)
          }
          else if (options.trigger === 'own_to') {
            notification.subtitle = util.format('<b>%s</b> replied to your message at patch <b>%s</b>: "%s"', options.from.creator.name, options.to.place.name, options.from.description)
          }
        }
        else {
          if (options.trigger === 'nearby') {
            notification.subtitle = util.format('<b>%s</b> replied to a message at nearby patch: "%s"', options.from.creator.name, options.from.description)
            notification.priority = 1
          }
          else if (options.trigger === 'watch_to') {
            notification.subtitle = util.format('<b>%s</b> replied to a message at patch: "%s"', options.from.creator.name, options.from.description)
          }
          else if (options.trigger === 'own_to') {
            notification.subtitle = util.format('<b>%s</b> replied to a your message at patch: "%s"', options.from.creator.name, options.from.description)
          }
        }
        if (options.from.photo)
          notification.type = 'media'
      }

      /* Message to a patch */
      else {
        var context = (options.from.photo) ? 'photo' : 'message'
        if (options.trigger === 'nearby') {
          var subtitle = '<b>%s</b> sent a %s to a nearby patch <b>%s</b>'
          if (options.from.description)
            notification.subtitle = util.format(subtitle += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          else
            notification.subtitle = util.format(subtitle, options.from.creator.name, context, options.to.name)

          notification.priority = 1
        }
        else if (options.trigger === 'watch_to') {
          var subtitle = '<b>%s</b> sent a %s to patch <b>%s</b>'
          if (options.from.description)
            notification.subtitle = util.format(subtitle += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          else
            notification.subtitle = util.format(subtitle, options.from.creator.name, context, options.to.name)
        }
        else if (options.trigger === 'own_to') {
          var subtitle = '<b>%s</b> sent a %s to your patch <b>%s</b>'
          if (options.from.description)
            notification.subtitle = util.format(subtitle += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          else
            notification.subtitle = util.format(subtitle, options.from.creator.name, context, options.to.name)
        }
        if (options.from.photo)
          notification.type = 'media'
      }
    }
  }

  if (!notification.sortDate)
    notification.sortDate = notification.modifiedDate

  return notification
}