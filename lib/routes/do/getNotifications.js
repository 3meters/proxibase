/*
 * getNotifications
 *
 * Build the list of notifcations displayed in the Feed of the client
 * This is not to be confused with sending push notifications to the client
 *
 */

var buildNotification = require('./buildNotification')
var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

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

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var options = _.cloneDeep(req.body)
  run(req, options, function(err, messages, extras) {
    if (err) return res.error(err)
    res.send({
      data: messages,
      date: util.getTimeUTC(),
      count: messages.length,
      more: extras.more
    })
  })
}

/*
 * Internal method that can be called directly
 *
 * No top level limiting is done in this method. It is assumed that the caller has already
 * identified the desired set of entities and handled any limiting.
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var err = scrub(options, _body)
  if (err) return done(err)

  var seedIds = []
  var seedCreateIds = []
  var seedWatchIds = []

  var userLinks = []
  var entityIds = []
  var entities = []
  var extras = { more: false }

  findSeeds()

  /*
   * First we want to find all entities that the focus entity has a connection to. To do
   * that we find all links from the focus entity that match on type and target schema. All
   * entities found via link._to are gathered.
   *
   * Our 'entities of interest' can include patches (watching or owned)
   * or messages (owned or shared back).
   */
  function findSeeds() {

    // find all patches or messages the user has created or is watching
    var query = {
      _from: options.entityId,
      type: { $in: ['create','watch'] },
      enabled: true,
    }

    var linkOps = _.cloneDeep(req.dbOps)
    linkOps.limit = statics.db.limits.join
    linkOps.sort = '-modifiedDate'

    db.links.safeFind(query, linkOps, function(err, links) {
      if (err) return done(err)

      var seedMap = {}
      var seedCreateMap = {}
      var seedWatchMap = {}

      links.forEach(function(link) {
        seedMap[link._to] = link._to
        if (link.type === statics.typeWatch) {
          seedWatchMap[link._to] = link._to
        }
        else if (link.type === statics.typeCreate) {
          seedCreateMap[link._to] = link._to
        }
      })

      for (var propertyName in seedMap) {
        seedIds.push(seedMap[propertyName])
      }

      for (propertyName in seedCreateMap) {
        seedCreateIds.push(seedCreateMap[propertyName])
      }

      for (propertyName in seedWatchMap) {
        seedWatchIds.push(seedWatchMap[propertyName])
      }

      if (options.log) {
        log('==================\ngetNotifications')
        log('seedCreateIds', seedCreateIds)
        log('seedWatchIds', seedWatchIds)
      }
      findFroms()
    })
  }

  function findFroms() {
    /*
     * link._owner = docTo._owner // Changed 8/21/14
     * link._creator = docFrom._creator
     * link._modifier = docFrom._modifier
     *
     * from == user, type == watch
     *    _to == [patch],
     *    _owner == [patch owner],
     *    _creator == [user creator [admin]],
     *    _modifier == [last user modifier]

     * from == message, type == content
     *    _to == [patch or parent message],
     *    _owner == [patch or parent message owner],
     *    _creator == [message creator],
     *    _modifier == [message modifier]

     * from == message, type == share
     *    _to == [user shared to],
     *    _owner == [user shared to],
     *    _creator == [message creator],
     *    _modifier == [message modifier]

     * from == user, type == like
     *    _to == [patch|message],
     *    _owner == [patch|message owner],
     *    _creator == [user creator],
     *    _modifier == [user modifier]

     */
    var query = {
      $or: [
        // Active and pending watch links to a patch I own
        { type:       statics.typeWatch,
          _owner:     options.entityId,
          _from:     { $ne: options.entityId },
          toSchema:   statics.schemaPatch,
          fromSchema: statics.schemaUser,
        },
        // Share messages to me
        { type:       statics.typeShare,
          _to:        options.entityId,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage
        },
      ]
    }

    // Messages to patches I'm watching or own (not from me)
    if (seedIds.length) query.$or.push({
      type:       statics.typeContent ,
      _to:        { $in: seedIds },
      _creator:   { $ne: options.entityId },
      fromSchema: statics.schemaMessage
    })

    // Likes to patches and messages I own (not from me)
    if (seedCreateIds.length) query.$or.push({
      type:       statics.typeLike ,
      _to:        { $in: seedCreateIds },
      _from:     { $ne: options.entityId },
      fromSchema: statics.schemaUser
    })

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
    /* Build and return the entity objects. */
    if (entityIds.length === 0) return cb(err, [], extras)

    options.entityIds = entityIds

    /* Strip params that shouldn't pass through */
    delete options.cursor
    delete options.events

    /* Grant authenticated user bulk read permissions on messages sent to her */
    if (req.dbOps.user && req.dbOps.user._id === options.entityId) {
      req.dbOps.asReader = true
    }

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
