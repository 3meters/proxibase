/*
 * getNotifications
 *
 * Build the list of notifcations displayed in the Feed of the client
 * This is not to be confused with sending push notifications to the client
 *
 * author: Jay
 * maintainer: George
 *
 */

var buildNotification = require('./buildNotification')
var getEntities = require('./getEntities').run

var _body = {
  entityId:     { type: 'string', required: true },
  cursor:       { type: 'object', required: true, value: {
    sort:         { type: 'object', default: { modifiedDate: -1 }},
    skip:         { type: 'number', default: 0 },
    more:         { type: 'boolean', default: true},
    limit:        { type: 'number', default: statics.db.limits.default,  // applied per entity type
      validate: function(v) {
        if (v > statics.db.limits.max) {
          return 'Max entity limit is ' + statics.db.limits.max
        }
        return null
      },
    },
  }},
  log:  { type: 'boolean' },
}


// Public method
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  run(req, req.body, function(err, messages, extras) {
    if (err) return res.error(err)
    res.send({
      data: messages,
      date: util.getTimeUTC(),
      count: messages.length,
      more: extras.more
    })
  })
}


// Internal method
var run = exports.run = function(req, options, cb) {

  var err = scrub(options, _body)
  if (err) return done(err)

  var userId = options.entityId
  var patchWatchIds = []
  var patchOwnIds = []
  var msgOwnIds = []

  var userLinks = []
  var entityIds = []
  var entities = []
  var extras = { more: false }

  findMyEntities()

  // Find the entities the user cares about
  function findMyEntities() {

    var seedOps = _.assign(_.cloneDeep(req.dbOps), {
      limit: statics.db.limits.join,
      sort: '-modifiedDate',
      fields:  {_to: 1},
    })

    // Find patches I watch
    var query = {_from: userId, toSchema: 'patch', type: 'watch', enabled: true}

    db.links.safeFind(query, seedOps, function(err, links) {
      if (err) return done(err)

      links.forEach(function(link) { patchWatchIds.push(link._to) })

      seedOps.fields = {_id: 1}
      query = {_owner: userId}

      // Find patches I own
      db.patches.safeFind(query, seedOps, function(err, patches) {
        if (err) return done(err)

        patches.forEach(function(patch) { patchOwnIds.push(patch._id) })

        // Find messages I own
        db.messages.safeFind(query, seedOps, function(err, msgs) {
          if (err) return done(err)

          msgs.forEach(function(msg) { msgOwnIds.push(msg._id) })

          findLinks()
        })
      })
    })
  }


  function findLinks() {

    var query = {
      $or: [
        // Share messages to me
        {
          _to:        userId,
          fromSchema: 'message',
          type:       'share',
          _creator:   {$ne: userId},
        },
        // Content messages to patches I watch
        {
          _to:         { $in: patchWatchIds },
          fromSchema:  'message',
          type:        'content',
          _creator:    { $ne: userId },
        },
        // Watch links to patches I own
        {
          _to:         { $in: patchOwnIds },
          fromSchema:  'user',
          type:        'watch',
          _creator:    { $ne: userId },
        },
        // Like links to messages I own
        {
          _to:         { $in: msgOwnIds},
          fromSchema:  'user',
          type:        'like',
          _creator:    { $ne: userId },
        }
      ]
    }


    var findOps = _.cloneDeep(req.dbOps)
    findOps.limit = options.limit || options.cursor.limit
    findOps.sort  = options.sort  || options.cursor.sort
    findOps.skip  = options.skip  || options.cursor.skip
    findOps.more  = options.more  || options.cursor.more

    db.links.safeFind(query, findOps, function(err, links, meta) {
      if (err) return done(err)

      var entityMap = {}
      extras.more = (meta && meta.more)

      /* Map prevents dupes */
      links.forEach(function(link) {
        entityMap[link._from] = link._from
        entityMap[link._to] = link._to
      })

      for (var key in entityMap) {
        entityIds.push(entityMap[key])
      }

      if (options.log && links) {
        log('FindFroms: Total items found using links: ' + links.length)
        log('FindFroms: Total entity ids to lookup: ' + entityIds.length)
      }

      userLinks = links
      doGetEntities()
    })
  }

  function doGetEntities() {
    // Build and return the entity objects
    if (entityIds.length === 0) return cb(err, [], extras)

    options.entityIds = entityIds

    // Strip params that shouldn't pass through
    delete options.cursor
    delete options.events

    // Grant authenticated user bulk read permissions on messages sent to her
    if (req.dbOps.user && req.dbOps.user._id === userId) {
      req.dbOps.asReader = true
    }

    // TODO: replace with safeFind
    getEntities(req, options, function(err, items) {
      if (err) return done(err)
      entities = items
      build()
    })
  }

  function build() {

    var notificationMap = {}
    var notifications = []

    userLinks.forEach(function(link) {

      var to = entities.reduce(function(a, b) {
        if (link._to === a._id) return a
        else return b
      })
      if (!to) return

      var from = entities.reduce(function(a, b) {
        if (link._from === a._id) return a
        else return b
      })
      if (!from) return

      var trigger
      if (req.user._id === to._owner)
        trigger = 'own_to'
      else if (req.user._id === from._owner)
        trigger = 'own_from'
      else
        trigger = 'watch_to'

      var event
      if (link.type === statics.typeWatch) {
        event = 'watch_entity_patch'
        if (to.visibility === 'private') {
          if (!link.enabled)
            event = 'request_watch_entity'
          else
            event = 'approve_watch_entity'
        }
      }
      else if (link.type === statics.typeContent) {
        event = 'insert_entity_message'
      }
      else if (link.type === statics.typeShare) {
        event = 'insert_entity_message_share'
      }
      else if (link.type === statics.typeCreate) {
        event = 'insert_entity_patch'
      }
      else if (link.type === statics.typeLike) {
        event = 'like_entity_' + link.toSchema
      }

      if (trigger) {
        var options = {
          event: event,
          to: to,
          from: from,
          link: link,
          trigger: trigger,
          priority: 2,   // These paint the feed in the UI, never chirp
        }

        var notification = buildNotification(options)
        notificationMap[notification.id] = notification
      }
    })

    for (var key in notificationMap) {
      notifications.push(notificationMap[key])
    }

    extras.count = notifications.length || 0
    cb(err, notifications || [], extras)
  }

  function done(err) {
    if (err) logErr(err)
    extras.count = 0
    cb(err, [], extras)
  }
}
