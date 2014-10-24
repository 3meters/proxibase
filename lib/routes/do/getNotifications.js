/*
 * getNotifications
 */

var push = require('./push')
var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

var _body = {
  entityId:     { type: 'string', required: true },
  cursor:       { type: 'object', required: true, value: {
    sort:         { type: 'object', default: { modifiedDate: -1 }},
    skip:         { type: 'number', default: 0 },
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

  var options = util.clone(req.body)
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
   * Our 'entities of interest' can include places (watching or owned)
   * or messages (owned or shared back).
   */
  function findSeeds() {

    var query = {
      _from: options.entityId,
      type: { $in: ['create','watch'] },
      toSchema: { $in: ['place','message'] },
      enabled: true,
    }

    var linkOps = util.clone(req.dbOps)
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

      for (var propertyName in seedCreateMap) {
        seedCreateIds.push(seedCreateMap[propertyName])
      }

      for (var propertyName in seedWatchMap) {
        seedWatchIds.push(seedWatchMap[propertyName])
      }

      if (options.log) {
        log('FindSeeds: Total seed entities found using links: ' + seedIds.length)
      }
      findFroms()
    })
  }

  function findFroms() {

    var query = {
      $or: [
        { _to:        { $in: seedCreateIds },
          type:       statics.typeWatch,
          _creator:   { $ne: options.entityId },
          toSchema:   statics.schemaPlace,
          fromSchema: statics.schemaUser,
        },
        { _to:        { $in: seedCreateIds },
          type:       statics.typeCreate,
          _owner:     options.entityId,
          toSchema:   statics.schemaPlace,
          fromSchema: statics.schemaUser,
        },
        { _to:        { $in: seedWatchIds },
          type:       statics.typeWatch,
          _creator:   options.entityId,
          fromSchema: statics.schemaUser,
        },
        { _to:        { $in: seedIds },
          type:       statics.typeContent ,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage
        },
        { _to:        options.entityId,
          type:       statics.typeShare,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage
        },
        { type:       statics.typeWatch,
          _creator:   options.entityId,
          toSchema:   statics.schemaPlace,
          fromSchema: statics.schemaUser,
          enabled: false,
        },
      ]
    }

    var findOps = util.clone(req.dbOps)
    findOps.limit = options.cursor.limit
    findOps.sort = options.cursor.sort
    findOps.skip = options.cursor.skip

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
      if (req.user._id === to._owner && req.user._id === from._owner)
        trigger = 'own_both'
      else if (req.user._id === to._owner)
        trigger = 'own_to'
      else if (req.user._id === from._owner)
        trigger = 'own_from'
      else
        trigger = 'watch_to'

      var event
      if (link.type === statics.typeWatch) {
        event = 'watch_entity_place'
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
        event = 'insert_entity_place'
      }

      if (trigger) {
        var options = {
          event: event,
          to: to,
          from: from,
          link: link,
          trigger: trigger,
        }

        var notification = push.buildNotification(options)
        notificationMap[notification.id] = notification
      }
    })

    for (var key in notificationMap) {
      notifications.push(notificationMap[key])
    }

    cb(err, notifications || [], extras)
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, [], extras)
  }
}
