/*
 * routes/do/push.js
 *
 * Push notification module
 *   author: jay
 */
var Parse = require('parse').Parse
var async = require('async')
var getEntities = require('./getEntities').run

exports.sendNotification = function(options, cb) {
  /*
   * Our important scenarios are proximity and watching.
   */
  var _options = {
    event:        { type: 'string', required: true },                         // event signature like 'insert_entity_message'
    triggers:     { type: 'array', default: ['nearby','own_to','watch_to'] }, // active triggers
    from:         { type: 'object' },                                         // optimize if from entity already available
    fromId:       { type: 'string' },                                         // id of 'link from' entity if one
    to:           { type: 'object' },                                         // optimize if to entity already available
    toId:         { type: 'string' },                                         // id of 'link to' entity if one
    link:         { type: 'object' },                                         // link if involved. event signature keys it's use
    beaconIds:    { type: 'array' },                                          // beacons associated with event to support nearby trigger
    locations:    { type: 'array' },                                          // locations associated with event to support nearby trigger
    blockedId:    { type: 'string' },                                         // user who should be excluded from notifications
    log:          { type: 'boolean' },                                        // true to print diagnostics to the console
  }

  var err = scrub(options, _options)

  if (err) {
    logErr('Invalid call to push: ', err)
    return done(err)
  }

  options.log = options.log || options.debug  // Backwards compat

  var timeLimit = util.getTime() - 915000  // 15 minutes
  var installMap = {}
  var notifications = []
  var fields = {
    parseInstallId: true,
    deviceType: true,
    deviceVersionName: true,
    _user: true,
  }

  /*
   * For now we only work with the first location in the array. We don't currently have
   * any use cases that provide more than one though the code will gather them if an
   * entity is inserted with links to more than one patch.
   */
  var location
  if (options.locations && options.locations.length > 0)
    location = options.locations[0]

  addNotificationEntities()

  function addNotificationEntities() {
    if (options.log) log('addNotificationEntities')

    var entityIds = []

    if (!options.to && options.toId)
      entityIds.push(options.toId)
    if (!options.from && options.fromId)
      entityIds.push(options.fromId)

    async.each(entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      // I do not believe this commented-out code ever worked -- george
      //
      // var entityIdParsed = util.parseId(entityId)
      // var entityCollection = entityIdParsed.collectionName
      // var query = { _id: entityId }
      // util.db[entityCollection].findOne(query, function(err, entity) {
      //

      // TODO: setting asReader is a lazy security hole
      getEntities({dbOps: {asReader: true}}, {entityIds: [entityId]}, function(err, results) {
        if (err) return next(err)
        if (results && results.length) {
          var entity = results[0]
          if (options.fromId === entity._id) options.from = entity
          if (options.toId === entity._id) options.to = entity
        }
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)

      /* Quick eliminations */
      if (!supportedNotification(options)) {
        if (options.log) log('Skipping unsupported notification event: ' + options.event)
        return done()
      }
      else {
        if (options.triggers.indexOf('nearby') === -1)
          checkForEntityWatchNotifications()
        else
          checkForProximityNearbyNotifications()
      }
    }
  }

  /*
   * Look for users that are near the provided beacons. We look for users that reported
   * recent visibility of one or more beacons in common with the provided beacons. User beacons
   * are captured when they execute proximity searches and by calls to updateProximity.
   */
  function checkForProximityNearbyNotifications() {

    if (!options.beaconIds) {
      checkForLocationNearbyNotifications()
    }
    else {
      if (options.log) log('Checking for nearby notifications by proximity')

      var query = {
        parseInstallId: { $exists: true },
        beacons:        { $elemMatch: { $in: options.beaconIds }},
        beaconsDate:    { $gte: timeLimit }
      }

      util.db.installs.find(query, fields).toArray(function (err, installs) {
        if (err) {
          logErr('Find failed in push: ', err)
          return done(err)
        }

        if (options.log) log('Nearby candidates by proximity mapped: ' + installs.length)
        for (var i = installs.length; i--;) {
          if (!options.blockedId || options.blockedId !== installs[i]._user) {
            installMap[installs[i].parseInstallId] = { trigger: 'nearby', install: installs[i] }
          }
        }

        checkForLocationNearbyNotifications()
      })
    }
  }

  /*
   * Look for users that are near the provided location. User locations
   * are captured when they execute near searches and by calls to updateProximity.
   */
  function checkForLocationNearbyNotifications() {

    if (!location) {
      checkForEntityWatchNotifications()
    }
    else {
      if (options.log) log('Checking for nearby notifications by location')
      /*
       * We ignore locations with very poor accuracy. We can tune the threshold
       * based on results in the field.
       */
      var query = {
        parseInstallId:   { $exists: true },    // install must have this to get notifications
        locationDate:     { $gte: timeLimit },  // we consider the location stale after fifteen minutes
        'location.accuracy': { $lte: 500 },     // ignore locations with very poor accuracy
        'location.geometry': {
          $near: [location.lng, location.lat],
          $maxDistance: (50 / 111120),          // within 50 meters
        },
      }


      util.db.installs.find(query, fields).toArray(function (err, installs) {
        if (err) {
          logErr('Find failed in push: ', err)
          return done(err)
        }

        if (options.log) log('Nearby candidates by location mapped: ' + installs.length)
        for (var i = installs.length; i--;) {
          if (!options.blockedId || options.blockedId !== installs[i]._user) {
            installMap[installs[i].parseInstallId] = { trigger: 'nearby', install: installs[i] }
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
    if (options.log) log('Checking for entity watch notifications')

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
    if (options.log) log('Checking for [to] entity create notifications')

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

    // Noop if own_from is not a trigger
    if (options.triggers.indexOf('own_from') < 0) return finishNotification()

    // Handle creator of the child entity */
    var userIds = [options.from._owner]
    findInstalls(userIds, 'own_from', function(err) {
      if (err) {
        logErr('findInstalls failed in push: ', err)
        return done(err)
      }
      finishNotification()
    })
  }

  /*
   * Assemble notification notifications.
   */
  function finishNotification() {
    if (options.log) log('finishNotification')

    /* Nobody was registered for the notification */
    if (Object.keys(installMap).length === 0) {
      if (cb) {
        notifications.push({
          info: 'notification constructed but no triggers identified',
        })
        if (options.log) log(notifications[0].info)
      }
      return done()
    }

    /* We know we have notifications to push so initialize parse */
    Parse.initialize(
      "EonZJ4FXEADijslgqXCkg37sOGpB7AB9lDYxoHtz",   // application id
      "G0MaKnU54Q1NZ4POA9NZ2Yuk0PfKfpcoLw6OuCHR"    // javascript key
    )

    if (options.log) log('Active install map:', installMap)

    options.triggers.forEach(function(trigger) {
      var parseInstalls = { android:[], ios:[], ios_7:[] }
      var test_push = false

      for (var key in installMap) {
        if (installMap[key].trigger === trigger) {
          var majorVersion = installMap[key].install.deviceVersionName.split('.')[0]
          var deviceTarget = installMap[key].install.deviceType
          if (deviceTarget === 'ios' && majorVersion === 7) {
              deviceTarget = 'ios_7'
          }
          parseInstalls[deviceTarget].push(key)
          if (key.indexOf('testing') >= 0) {
            test_push = true
          }
        }
      }

      for (var target in parseInstalls ) {
        if (parseInstalls[target].length > 0) {
          var params = {
            event: options.event,
            to: options.to,
            from: options.from,
            link: options.link,
            trigger: trigger,
            deviceTarget: target,
          }
          var notification = buildNotification(params)
          notifications.push(notification)
          if (test_push) {
            notification.parseInstallIds = parseInstalls[target]
          }
          else {
            sendNotifications(notification, parseInstalls[target], options)
          }
        }
      }
    })

    done()
  }

  function supportedNotification(options) {
    if (options.event.indexOf('watch_entity_patch') === 0)
      return true
    if (options.event.indexOf('request_watch_entity') === 0)
      return true
    if (options.event.indexOf('approve_watch_entity') === 0)
      return true
    if (options.event.indexOf('insert_entity_patch') === 0)
      return true
    if (options.event.indexOf('like_entity_patch') === 0)
      return true
    if (options.event.indexOf('like_entity_message') === 0)
      return true
    if (options.event.indexOf('insert_entity_message') === 0) {
      if (options.event.indexOf('insert_entity_message_share') === 0) {
        if (options.to.schema === statics.schemaPatch) {
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
      parseInstallId: { $exists: true },
      _user: { $in: userIds },
    }

    db.installs.find(query, fields).toArray(function (err, installs) {
      if (err) callback(err)
      if (!installs) callback()
      /*
       * If we already had an install registered for a nearby notification, it will
       * be overridden by the watch notification. 'Watch' is more explicit than 'nearby'
       * and we don't want to notification the user twice about the same action.
       */
      if (options.log) log(trigger + ' candidates mapped: ' + installs.length)
      for (var i = installs.length; i--;) {
        if (!options.blockedId || options.blockedId !== installs[i]._user) {
          installMap[installs[i].parseInstallId] = { trigger: trigger, install: installs[i] }
        }
      }
      callback()
    })
  }
}

var sendNotifications = exports.sendnotifications = function(notification, parseInstallIds, options) {
  /*
   * This gets called once for each trigger type that is active. It returns
   * immediately after the notification has been passed off to the gcm sender.
   */
  if (options.log)
    log('Sending ' + notification.trigger + ' notifications to ' + parseInstallIds.length + ' installs(s)')

  var query = new Parse.Query(Parse.Installation)
  query.containedIn('installationId', parseInstallIds)
  Parse.Push.send({
      where: query,
      data: notification
    }, {
      success: function() {
        /* Push was successful */
        if (options.log) log('Success sending parse notification')
      },
      error: function(error) {
        /* Push failed */
        if (error) {
          util.logErr('Error sending parse notification', error)
          return
        }
      }
  })
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
    event:        { type: 'string', required: true },
    trigger:      { type: 'string', required: true },
    to:           { type: 'object', required: true },
    from:         { type: 'object' },
    link:         { type: 'object' },
    deviceTarget: { type: 'string', default: 'none' },
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
  var privacy
  var summary
  var notification = {
    schema: 'notification',
    event: options.event,
    trigger: options.trigger,
    _creator: admin._id,
    _modifier: admin._id,
    creator: admin,
    modifier: admin,
    priority: 2,
    subtitle: 'subtitle', // to protect client versions that don't expect this to ever be null
  }

  if (options.event === 'watch_entity_patch') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> started watching your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.summary
    }
    else if (options.trigger === 'own_from') {
      notification.summary = util.format('You started watching %spatch <b>%s</b>', privacy, options.to.name)
    }
    else if (options.trigger === 'own_both') {
      notification.summary = util.format('You started watching your own %spatch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event === 'request_watch_entity') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> wants to join your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = util.format('<b>%s</b> wants to join your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
    }
    else if (options.trigger === 'own_from') {
      notification.summary = util.format('You asked to join %spatch <b>%s</b>', privacy, options.to.name)
    }
  }

  else if (options.event === 'approve_watch_entity') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> joined your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.photo = options.from.photo
      notification.userId = options.from._id
    }
    else if (options.trigger === 'own_from') {
      notification.summary = util.format('<b>%s</b> approved your request to join %spatch <b>%s</b>', options.to.creator.name, privacy, options.to.name)
      notification.ticker = notification.summary
      notification.name = options.to.creator.name
      notification.photo = options.to.creator.photo
      notification.userId = options.to.creator._id
    }
    else if (options.trigger === 'own_both') {
      notification.summary = util.format('You started watching your own %spatch <b>%s</b>', privacy, options.to.name)
      notification.photo = options.from.photo
      notification.userId = options.from._id
    }
  }

  else if (options.event === 'like_entity_patch') {
    /*
     * [user] -> like -> [patch]
     */
    notification.type = 'like'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> liked your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.summary
    }
    else if (options.trigger === 'own_both') {
      notification.summary = util.format('<b>%s</b> liked a %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.summary
    }
  }

  else if (options.event === 'like_entity_message') {
    /*
     * [user] -> like -> [message]
     */
    notification.type = 'like'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.createdDate = options.link.createdDate
    notification.modifiedDate = options.link.modifiedDate
    notification.sortDate = notification.modifiedDate // Ok to change sort position because of editing.
    notification.userId = options.from._id

    if (options.trigger === 'own_to') {
      if (options.to.photo && !options.to.description) {
        notification.summary = util.format('<b>%s</b> liked your photo', options.from.name)
        notification.subtitle = 'Liked your photo'
        notification.ticker = notification.summary
        notification.photoBig = options.to.photo
      }
      else {
        notification.summary = util.format('<b>%s</b> liked your message: "%s"', options.from.name, options.to.description)
        notification.ticker = notification.summary
      }
    }
    else if (options.trigger === 'own_both') {
      if (options.to.photo && !options.to.description) {
        notification.summary = util.format('<b>%s</b> liked a photo', options.from.name)
        notification.subtitle = 'Liked a photo'
        notification.ticker = notification.summary
        notification.photoBig = options.to.photo
      }
      else {
        notification.summary = util.format('<b>%s</b> liked a message: "%s"', options.from.name, options.to.description)
        notification.ticker = notification.summary
      }
    }
  }

  else if (options.event === 'insert_entity_patch') {
    /*
     * [empty] -> empty -> [patch]
     * [user] -> create -> [patch]
     */
    notification.type = 'patch'
    notification.name = options.to.creator.name
    notification.id = 'no' + options.to._id.substring(2)
    notification._target = options.to._id
    notification.photo = options.to.creator.photo
    notification.photoBig = options.to.photo
    notification.createdDate = options.to.createdDate
    notification.modifiedDate = options.to.modifiedDate
    notification.sortDate = notification.createdDate // We don't want it changing sort position because of editing.
    notification.userId = options.to.creator._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'nearby') {
      notification.summary = util.format('<b>%s</b> created the %spatch <b>%s</b> nearby', options.to.creator.name, privacy, options.to.name)
      notification.subtitle = util.format('Created the %spatch <b>%s</b> nearby', privacy, options.to.name)
      notification.ticker = notification.summary
      notification.priority = 1
    }
    else if (options.trigger === 'own_both') {
      notification.summary = util.format('You created the %spatch <b>%s</b>', privacy, options.to.name)
      notification.subtitle = util.format('Created the %spatch <b>%s</b> nearby', privacy, options.to.name)
    }
  }

  else if (options.event.indexOf('insert_entity_message') === 0) {
    /*
     * [message[creator]] -> content -> [patch]
     * [message[creator]] -> content -> [message]
     */
    notification.type = 'message'
    notification.name = options.from.creator.name
    notification.id = 'no' + options.from._id.substring(2)
    notification._target = options.from._id
    notification._parent = options.to._id
    notification.photo = options.from.creator.photo
    notification.photoBig = options.from.photo
    notification.createdDate = options.from.createdDate
    notification.modifiedDate = options.from.modifiedDate
    notification.sortDate = notification.createdDate // We don't want it changing sort position because of editing.
    notification.ticker = 'Message from Patchr'
    notification.userId = options.from.creator._id

    if (options.event === 'insert_entity_message_share') {
      /*
       * [message[creator]] -> share -> [user]
       */
      notification.type = 'share'
      notification.trigger = 'share'
      if (options.from.photo) {
        notification.summary = util.format('<b>%s</b> shared a photo with you', options.from.creator.name)
        notification.ticker = notification.summary
        notification.subtitle = 'Shared with you'
      }
      else {
        notification.summary = util.format('<b>%s</b> shared with you: "%s"', options.from.creator.name, options.from.description)
        notification.ticker = notification.summary
        notification.description = options.from.description
        notification.subtitle = 'Shared with you'
      }
    }
    else {

      /* Reply to a message */
      if (options.to.schema === statics.schemaMessage) {
        if (options.to.patch) {
          notification.subtitle = util.format('<b>%s</b> patch', options.to.patch.name)
          if (options.trigger === 'nearby') {
            notification.summary = util.format('<b>%s</b> replied to a message at nearby patch <b>%s</b>: "%s"', options.from.creator.name, options.to.patch.name, options.from.description)
            notification.priority = 1
          }
          else if (options.trigger === 'watch_to') {
            notification.summary = util.format('<b>%s</b> replied to a message at patch <b>%s</b>: "%s"', options.from.creator.name, options.to.patch.name, options.from.description)
          }
          else if (options.trigger === 'own_to') {
            notification.summary = util.format('<b>%s</b> replied to your message at patch <b>%s</b>: "%s"', options.from.creator.name, options.to.patch.name, options.from.description)
          }
        }
        else {
          notification.subtitle = 'Reply'
          if (options.trigger === 'nearby') {
            notification.summary = util.format('<b>%s</b> replied to a message at nearby patch: "%s"', options.from.creator.name, options.from.description)
            notification.description = options.from.description
            notification.priority = 1
          }
          else if (options.trigger === 'watch_to') {
            notification.summary = util.format('<b>%s</b> replied to a message at patch: "%s"', options.from.creator.name, options.from.description)
            notification.description = options.from.description
          }
          else if (options.trigger === 'own_to') {
            notification.summary = util.format('<b>%s</b> replied to a your message at patch: "%s"', options.from.creator.name, options.from.description)
            notification.description = options.from.description
          }
        }
        if (options.from.photo)
          notification.type = 'media'
      }

      /* Message to a patch */
      else {
        var context = (options.from.photo) ? 'photo' : 'message'
        notification.subtitle = util.format('<b>%s</b> patch', options.to.name)

        if (options.trigger === 'nearby') {
          summary = '<b>%s</b> sent a %s to a nearby patch <b>%s</b>'
          if (options.from.description) {
            notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
            notification.description = options.from.description
          }
          else {
            notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
          }

          notification.priority = 1
        }
        else if (options.trigger === 'watch_to') {
          summary = '<b>%s</b> sent a %s to patch <b>%s</b>'
          if (options.from.description) {
            notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
            notification.description = options.from.description
          }
          else {
            notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
          }
        }
        else if (options.trigger === 'own_to') {
          summary = '<b>%s</b> sent a %s to your patch <b>%s</b>'
          if (options.from.description) {
            notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
            notification.description = options.from.description
          }
          else {
            notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
          }
        }
        if (options.from.photo)
          notification.type = 'media'
      }
    }
  }

  if (!notification.sortDate)
    notification.sortDate = notification.modifiedDate

  /*
   * Final transform based on device target.
   * Max size by deviceTarget: android: 4096, ios: 2048, ios_7:  256
   */
  if (options.deviceTarget === 'ios' || options.deviceTarget === 'ios_7') {

    var ios_notification = {
      alert: "",
      badge: "Increment",
      targetId: notification._target,
      parentId: notification._parent,
      trigger: notification.trigger,   // nearby|own_to|watch_to|share
    }

    var maxSize = (options.deviceTarget === 'ios_7') ? 256 : 2048
    var remaining = maxSize - JSON.stringify(ios_notification).length
    ios_notification.alert = notification.summary.substring(0, remaining)
    notification = ios_notification
  }

  return notification
}
