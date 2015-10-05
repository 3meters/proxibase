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

  var optionsSpec = {
    triggers:     { type: 'array', required: true, value: {
      type: 'string', value:
        'nearby|' +
        'own_to|' +
        'watch_to|' +
        'own_from'
    }},
    event:        { type: 'string', required: true, value:
      'watch_entity_patch|' +
      'request_watch_entity|' +
      'approve_watch_entity|' +
      'insert_entity_patch|' +
      'like_entity_patch|' +
      'like_entity_message|' +
      'insert_entity_message_content|' +
      'insert_entity_message_share'
    },
    from:         { type: 'object' },         // optimize if from entity already available
    fromId:       { type: 'string' },         // id of 'link from' entity if one
    to:           { type: 'object' },         // optimize if to entity already available
    toId:         { type: 'string' },         // id of 'link to' entity if one
    link:         { type: 'object' },         // link if involved. event signature keys its use
    beaconIds:    { type: 'array' },          // beacons associated with event to support nearby trigger
    locations:    { type: 'array' },          // locations associated with event to support nearby trigger
    blockedId:    { type: 'string' },         // user who should be excluded from notifications
    log:          { type: 'boolean' },        // true to print diagnostics to stdout
  }

  var err = scrub(options, optionsSpec)
  if (err) return done(err)


  // Identify high-priority events
  var essentialEvents = [
    'request_watch_entity',
    'approve_watch_entity',
    'insert_entity_message_share',
    'insert_entity_patch',   // nearby
  ]

  options.log = options.log || options.test || options.debug

  var nearbyTimeLimit = util.getTime() - 915000  // 15 minutes

  var installMap = {}     // Unique installs, roughly meaning devices, though multiple users can share a device.
  var userMap = {}        // Unique users to be notified.  A user can have multiple installs, though this is rare.
  var mutedUserMap = {}   // Users who have muted relavant watch links
  var nMap = {}           // Unique notification keys: deviceType.trigger.event.priority.
                          //    Contains an array of parseInstallIds to receive each notification.
  var pushes = []         // Fully assembled unique notifications to be sent to Parse.

  // To the database run under the acting user's _id but with elevated permissions
  var dbOps = {
    user: {_id: options.blockedId, role: 'user'},
    limit: util.statics.db.limits.max,
    asAdmin: true,
  }

  // Future-proofing
  var location
  if (options.locations && options.locations.length > 0)
    location = options.locations[0]


  // These will be executed in order.  If any generate an error execution will stop.
  var tasks = [
    getEntities,
    checkNearbyProximity,
    checkNearbyLocation,
    checkWatchToEntity,
    checkOwnsToEntity,
    checkOwnsFromEntity,  // owner of newly enabled watch link
    prioritize,
    mapUnique,
    assemble,
    setUserNotifiedDates,
    send,
  ]

  async.waterfall(tasks, done)

  function getEntities(next) {
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
      if (!validateEvents(options)) return done()
      next()
    }
  }

  /*
   * Look for users that are near the provided beacons. We look for users that reported
   * recent visibility of one or more beacons in common with the provided beacons. User beacons
   * are captured when they execute proximity searches and by calls to updateProximity.
   */
  function checkNearbyProximity(next) {

    if (options.triggers.indexOf('nearby') < 0) return next()
    if (!options.beaconIds) return next()

    if (options.log) log('Checking for nearby notifications by proximity', options.beaconIds)

    var query = {
      beacons:        { $elemMatch: { $in: options.beaconIds }},
      beaconsDate:    { $gte: nearbyTimeLimit }
    }

    findInstalls(query, 'nearby', next)
  }


  /*
   * Look for users that are near the provided location. User locations
   * are captured when they execute near searches and by calls to updateProximity.
   */
  function checkNearbyLocation(next) {

    if (options.triggers.indexOf('nearby') < 0) return next()
    if (!location) return next()

    if (options.log) log('Checking for nearby notifications by location')
    /*
     * We ignore locations with very poor accuracy. We can tune the threshold
     * based on results in the field.
     */
    var query = {
      locationDate:     { $gte: nearbyTimeLimit },  // ignore stale device location.  TODO: test
      'location.accuracy': { $lte: 500 },           // ignore locations with poor accuracy
      'location.geometry': {
        $near: [location.lng, location.lat],
        $maxDistance: (50 / 111120),                // within 50 meters
      },
    }

    findInstalls(query, 'nearby', next)
  }


  // Look for users that are watching the parent that is getting
  // a new entity.
  function checkWatchToEntity(next) {

    if (options.triggers.indexOf('watch_to') < 0) return next()

    if (options.log) log('Checking for entity watch notifications')

    // Find watch links to the same patch to which a message has been added
    var query = {
      _to: options.to._id,
      fromSchema: 'user',
      type: 'watch',
      enabled: true,
    }

    db.links.safeFind(query, dbOps, function(err, links) {
      if (err) return done(err)
      if (!links.length) return next()

      var userIds = []
      links.forEach(function(link) {
        // Keep track of which users have muted their watch link
        if (link.mute) mutedUserMap[link._from] = true
        userIds.push(link._from)
      })
      var query = {_user: {$in: userIds}}
      findInstalls(query, 'watch_to', next)
    })
  }


  // Look for the user that created the parent entity that is getting a
  // New link.  Content is excluded because it is controled by watching.
  function checkOwnsToEntity(next) {
    if (options.triggers.indexOf('own_to') < 0) return next()

    // Content alerts are covered by the watch flag, not the owner flag
    if (options.event === 'insert_entity_message_content') return next()

    if (options.log) log('Checking for [to] entity create notifications')
    var query = {_user: {$in: [options.to._owner]}}
    findInstalls(query, 'own_to', next)
  }


  // Look for the user that created the parent entity that is getting
  // a new entity. Owning trumps watching.
  function checkOwnsFromEntity(next) {

    // Noop if own_from is not a trigger
    if (options.triggers.indexOf('own_from') < 0) return next()

    // Handle owner of the child entity
    var query = {_user: {$in: [options.from._owner]}}
    findInstalls(query, 'own_from', next)
  }


  // Prioritize notifications
  function prioritize(next) {

    for (var parseInstallId in installMap) {
      var notification = installMap[parseInstallId]

      // Default to high priority
      notification.priority = 1

      // if (options.event === 'insert_entity_message_content' &&
      // The differece between this test and the previous is whether 
      // users phones will chip when some likes a message they posted
      // to a patch that they have muted.
      if (!isEssential(options.event) &&
          mutedUserMap[notification.install._user]) {
        notification.priority = 2  // turn off device chirping
      }
    }
    next()
  }


  // Iterate over the installMap, building nMap, the notification map, which holds unique
  // notifications defined by deviceType.trigger.event.priority.parseId
  function mapUnique(next) {

    // module scoped
    nMap = {
      ios: {},
      android: {},
    }

    for (var parseId in installMap) {

      // Each notification fetus now has an install, a trigger, and a priority, but nothing else
      var fetus = installMap[parseId]

      // Define the properties that will map a unique push to Parse
      var deviceType = fetus.install.deviceType
      var trigger = fetus.trigger
      var event = options.event
      var priority = fetus.priority

      // Paranoid
      if (!nMap[deviceType]) return done(perr.ServerError('Invalid notification device type', deviceType))

      // Incrementally build a very deep map
      nMap[deviceType][trigger] = nMap[deviceType][trigger] || {}
      nMap[deviceType][trigger][event] = nMap[deviceType][trigger][event] || {}
      nMap[deviceType][trigger][event][priority] = nMap[deviceType][trigger][event][priority] || {}
      nMap[deviceType][trigger][event][priority][parseId] = true  // whew!
    }

    // nMap now contains the keys necessay to build unique notifications
    // for an array of parse installIds, aka devices held by humans.
    next()
  }


  // Iterate over nMap to flesh out the actual data to send to Parse
  function assemble(next) {
    for (var deviceType in nMap) {
      for (var trigger in nMap[deviceType]) {
        for (var event in nMap[deviceType][trigger]) {
          for (var priority in nMap[deviceType][trigger][event]) {
            var notification = buildNotification({
              to: options.to,
              from: options.from,
              link: options.link,
              deviceTarget: deviceType,
              trigger: trigger,
              event: event,
              priority: priority,
            })
            var parseIds = []
            for (var parseId in nMap[deviceType][trigger][event][priority]) {
              parseIds.push(parseId)
            }
            // Each push is a object that contains the notification itself
            // and an array of parseIds to whom that notification will be pushed
            pushes.push({parseInstallIds: parseIds, notification: notification})
          }
        }
      }
    }
    next()
  }


  // Update the users notified dates
  // Setting this date enables us to throttle notifications sent to a user based on when
  // we last sent her one. We don't do anything with this information currently.
  // This could become a hot spot in patch storms, and can be disabled without ill effect.
  // It is tested, so if you need to disable it expect to disable a some tests too.
  function setUserNotifiedDates(next) {
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


  // Send the notifications to parse
  function send(next) {

    if (options.log) log('Pushes', pushes)
    if (options.test) return next()

    // TODO: put keys in util.callService
    Parse.initialize(
      "EonZJ4FXEADijslgqXCkg37sOGpB7AB9lDYxoHtz",   // application id
      "G0MaKnU54Q1NZ4POA9NZ2Yuk0PfKfpcoLw6OuCHR"    // javascript key
    )

    async.eachSeries(pushes, pushToParse, next)

    // Each push contains a payload: a unique notification for this call
    // defined by deviceType.trigger.event.priority and an array of
    // parseInstallIds that should receive the notification
    function pushToParse(payload, nextPush) {

      // Belt and suspenders: remove parseIds with the string 'test' in them
      // Setting options.test should have the same effect upstream
      var parseIds = []
      payload.parseInstallIds.forEach(function(parseId) {
        if (parseId.indexOf('test') < 0) parseIds.push(parseId)  // ignore parseIds with the string 'test'
      })
      if (!parseIds.length) return nextPush()

      var where = new Parse.Query(Parse.Installation)
      where.containedIn('installationId', parseIds)

      var packet = {
        where: where,
        data: payload.notification,
      }

      var cb = {
        success: function() {
          if (options.log) log('Parse sent message', payload)
        },
        error: function(err) {
          if (err) {
            logErr('Error sending parse notification for', payload)
            logErr('Error', err)
          }
        }
      }

      // Do it
      Parse.Push.send(packet, cb)
      nextPush()
    }
    next()
  }


  // Share messages to patches do not generate notifications, only those to users
  function validateEvents(options) {
    if (options.event === 'insert_entity_message_share') {
      if (options.to.schema === statics.schemaUser) return true
      else return false
    }
    return true
  }


  // Utility
  function isEssential(event) {
    return essentialEvents.some(function(essential) { return (event === essential) })
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
      return cb(null, pushes)
    }
    else if (err) logErr(err)
  }
}
