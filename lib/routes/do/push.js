/*
 * routes/do/push.js
 *
 * Push notification module
 *   author: jay
 *   maintainer: george
 */
var Parse = require('parse').Parse
var buildNotification = require('./buildNotification')
var async = require('async')

exports.sendNotification = function(options, cb) {

  if (!(db && db.links)) return  // ignore if called during server bootstrap

  var _options = {
    event:        { type: 'string', required: true },     // event signature like 'insert_entity_message'
    triggers:     { type: 'array',                        // active triggers
      default: ['nearby','own_to','watch_to'] },
    from:         { type: 'object' },                     // optimize if from entity already available
    fromId:       { type: 'string' },                     // id of 'link from' entity if one
    to:           { type: 'object' },                     // optimize if to entity already available
    toId:         { type: 'string' },                     // id of 'link to' entity if one
    link:         { type: 'object' },                     // link if involved. event signature keys its use
    beaconIds:    { type: 'array' },                      // beacons associated with event to support nearby trigger
    locations:    { type: 'array' },                      // locations associated with event to support nearby trigger
    blockedId:    { type: 'string' },                     // user who should be excluded from notifications
    log:          { type: 'boolean' },                    // true to print diagnostics to stdout
  }

  var err = scrub(options, _options)

  if (err) {
    logErr('Invalid call to push: ', err)
    return done(err)
  }

  options.log = options.test || options.log || options.debug

  var timeLimit = util.getTime() - 915000  // 15 minutes
  var installMap = {}
  var notifications = []
  var userMap = {}
  var dbOps = {
    user: {_id: options.blockedId, role: 'user'},
    limit: util.statics.db.limits.max,
    asAdmin: true,
  }

  /*
   * For now we only work with the first location in the array. We don't currently have
   * any use cases that provide more than one though the code will gather them if an
   * entity is inserted with links to more than one patch.
   */
  var location
  if (options.locations && options.locations.length > 0)
    location = options.locations[0]


  // These will be executed in order.  If any generate an error execution will stop.
  var tasks = [
    addNotificationEntities,
    checkForProximityNearbyNotifications,
    checkForLocationNearbyNotifications,
    checkForEntityWatchNotifications,
    checkForToEntityCreateNotifications,
    checkForFromEntityCreateNotifications,
    rankNotifications,
    processRanked,
    setNotifiedDates,
    finishNotifications,
  ]

  async.waterfall(tasks, done)

  function addNotificationEntities(next) {
    if (options.log) log('==========================\nsendNotifications')

    var entityIds = []

    if (!options.to && options.toId) entityIds.push(options.toId)
    if (!options.from && options.fromId) entityIds.push(options.fromId)

    if (!entityIds.length) return finish()

    // If the to or from entities were not passed in look them up now
    var dbOps = {user: {_id: options.blockedId, role: 'user'}}
    db.safeFindByIds(entityIds, dbOps, function(err, results) {
      if (err) return done(err)
      results.forEach(function(entity) {
        if (options.fromId === entity._id) options.from = entity
        if (options.toId === entity._id) options.to = entity
      })
      finish()
    })

    function finish() {
      if (!options.to) return done()
      if (!supportedNotification(options)) return done()
      next()
    }
  }

  /*
   * Look for users that are near the provided beacons. We look for users that reported
   * recent visibility of one or more beacons in common with the provided beacons. User beacons
   * are captured when they execute proximity searches and by calls to updateProximity.
   */
  function checkForProximityNearbyNotifications(next) {

    if (options.triggers.indexOf('nearby') < 0) return next()
    if (!options.beaconIds) return next()

    if (options.log) log('Checking for nearby notifications by proximity', options.beaconIds)

    var query = {
      beacons:        { $elemMatch: { $in: options.beaconIds }},
      beaconsDate:    { $gte: timeLimit }
    }

    findInstalls(query, 'nearby', next)
  }


  /*
   * Look for users that are near the provided location. User locations
   * are captured when they execute near searches and by calls to updateProximity.
   */
  function checkForLocationNearbyNotifications(next) {

    if (options.triggers.indexOf('nearby') < 0) return next()
    if (!location) return next()

    if (options.log) log('Checking for nearby notifications by location')
    /*
     * We ignore locations with very poor accuracy. We can tune the threshold
     * based on results in the field.
     */
    var query = {
      locationDate:     { $gte: timeLimit },  // we consider the location stale after fifteen minutes
      'location.accuracy': { $lte: 500 },     // ignore locations with very poor accuracy
      'location.geometry': {
        $near: [location.lng, location.lat],
        $maxDistance: (50 / 111120),          // within 50 meters
      },
    }

    findInstalls(query, 'nearby', next)
  }


  /*
   * Look for users that are watching the parent that is getting
   * a new entity.
   */
  function checkForEntityWatchNotifications(next) {

    if (options.triggers.indexOf('watch_to') === -1 || !options.to) {
      return next()
    }

    if (options.log) log('Checking for entity watch notifications')

    /* Relate using watch links */
    var query = {
      _to: options.to._id,
      fromSchema: 'user',
      type: 'watch',
      enabled: true,
    }

    db.links.safeFind(query, dbOps, function(err, links) {
      if (err) return done(err)
      if (!(links && links.length)) return next()

      var userIds = []
      links.forEach(function(link) { userIds.push(link._from) })
      var query = {_user: {$in: userIds}}
      findInstalls(query, 'watch_to', next)
    })
  }

  /*
   * Look for the user that created the parent entity that is getting
   * a new entity. Owning trumps watching.
   */
  function checkForToEntityCreateNotifications(next) {
    if (options.triggers.indexOf('own_to') < 0) return next()

    if (options.log) log('Checking for [to] entity create notifications')

    /* Handle the owner of the parent entity */
    var query = {_user: {$in: [options.to._owner]}}
    findInstalls(query, 'own_to', next)
  }

  /*
   * Look for the user that created the parent entity that is getting
   * a new entity. Owning trumps watching.
   */
  function checkForFromEntityCreateNotifications(next) {

    // Noop if own_from is not a trigger
    if (options.triggers.indexOf('own_from') < 0) return next()

    // Handle owner of the child entity */
    var query = {_user: {$in: [options.from._owner]}}
    findInstalls(query, 'own_from', next)
  }


  // Rank notifications
  function rankNotifications(next) {
    if (_.isEmpty(userMap)) return done()
    next()
  }

  function processRanked(next) {
    next()
  }

  // Update the users notified dates
  function setNotifiedDates(next) {
    var now = util.now()
    var userDbOps = {
      user: statics.adminUser,
      preserveModified: true,  // don't change modifiedDate or modifier of the notified user
    }

    async.eachSeries(Object.keys(userMap), setNotifiedDate, next)

    function setNotifiedDate(userId, nextUser) {
      db.users.safeUpdate({_id: userId, notifiedDate: now}, userDbOps, nextUser)
    }
  }


  // Assemble and possibly send notification
  function finishNotifications(next) {
    if (options.log) log('finishNotification')

    /* Nobody was registered for the notification */
    if (Object.keys(installMap).length === 0) {
      if (options.log) log('notification constructed but no triggers identified')
      return next()
    }

    // We know we have notifications to push so initialize parse
    Parse.initialize(
      "EonZJ4FXEADijslgqXCkg37sOGpB7AB9lDYxoHtz",   // application id
      "G0MaKnU54Q1NZ4POA9NZ2Yuk0PfKfpcoLw6OuCHR"    // javascript key
    )

    if (options.log) log('Notification install map:', installMap)

    options.triggers.forEach(function(trigger) {  // trigger is nearby, own_to, or watch_to
      var parseInstalls = { android:[], ios:[], ios_7:[] }
      var test_push = false

      for (var parseId in installMap) {
        if (installMap[parseId].trigger === trigger) {
          var majorVersion = installMap[parseId].install.deviceVersionName.split('.')[0]
          var deviceTarget = installMap[parseId].install.deviceType
          if (deviceTarget === 'ios' && majorVersion === 7) {
            deviceTarget = 'ios_7'
          }
          parseInstalls[deviceTarget].push(parseId)
          // By convention our test cases use 'testing' in the parseId
          if (parseId.indexOf('testing') >= 0 || options.test) {
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
          if (options.log) {
            log('Target: ' + target)
            log('Notifying:', parseInstalls[target])
            log('Notification:', notification)
          }
          if (test_push) {
            notification.parseInstallIds = parseInstalls[target]
          }
          else {
            sendNotifications(notification, parseInstalls[target], options)
          }
        }
      }
    })

    next()
  }


  // Just in case
  function supportedNotification(options) {
    var event = options.event
    if (event.indexOf('watch_entity_patch') === 0)
      return true
    if (event.indexOf('request_watch_entity') === 0)
      return true
    if (event.indexOf('approve_watch_entity') === 0)
      return true
    if (event.indexOf('insert_entity_patch') === 0)
      return true
    if (event.indexOf('like_entity_patch') === 0)
      return true
    if (event.indexOf('like_entity_message') === 0)
      return true
    if (event.indexOf('insert_entity_message') === 0) {
      if (event.indexOf('insert_entity_message_share') === 0) {
        if (options.to.schema === statics.schemaPatch) {
          return false
        }
      }
      return true
    }
  }

  // These are notifications that need to happen immediately
  // and are independent of watching
  function essentialNotifications(options) {
    var priorityEvents = [
      'request_watch_entity',
      'approve_watch_entity',
      'insert_entity_message_share',
    ]
    if (priorityEvents.indexOf(options.event) >= 0) return true
    return false
  }


  // Utility: find installs based on a query, filter out invalid
  // ones, and add the results to the installMap and the userMap
  function findInstalls(query, trigger, cb) {
    db.installs.safeFind(query, dbOps, function (err, installs) {
      if (err) return cb(err)
      installs.forEach(function(install) {
        if (!install.parseInstallId) return   // old install before we used parse
        if (install._user === options.blockedId) return  // don't notify the user generating the event
        installMap[install.parseInstallId] = { trigger: trigger, install: install }
        userMap[install._user] = true
        if (options.log) log(trigger + ' install mapped: ', install)
      })
      cb()
    })
  }

  // All end paths should pass through here
  function done(err) {
    if (cb) {
      if (err) return cb(err)
      return cb(null, notifications)
    }
    else if (err) logErr(err)
  }
}


function sendNotifications(notification, parseInstallIds, options) {
  /*
   * This gets called once for each trigger type that is active. It returns
   * immediately after the notification has been passed off to the gcm sender.
   */
  if (options.log) {
    log('Sending ' + notification.trigger + ' notifications to:', parseInstallIds)
  }

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
        if (error) util.logErr('Error sending parse notification', error)
      }
  })
}
