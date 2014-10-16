/*
 * getAlerts
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
      toSchema: { $in: ['place'] },
      type: { $in: ['create','watch'] },
    }

    db.links.find(query, { type: true, _to: true }).toArray(function(err, links) {
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

      entityIds.push.apply(entityIds, seedIds)

      if (options.log) {
        log('FindSeeds: Total seed entities found using links: ' + seedIds.length)
      }
      findUsers()
    })
  }

  function findUsers() {

    var query = {
      $or: [
        { _to:        { $in: seedCreateIds },
          type:       statics.typeWatch,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaUser,
        },
        { _to:        { $in: seedWatchIds },
          type:       statics.typeWatch,
          _creator:   options.entityId,
          fromSchema: statics.schemaUser,
        },
      ]
    }

    var findOps = util.clone(req.dbOps)
    findOps.limit = options.cursor.limit
    findOps.sort = options.cursor.sort
    findOps.skip = options.cursor.skip

    db.links.safeFind(query, findOps, function(err, links, meta) {
      if (err) return done(err)

      var userMap = {}
      extras.more = (meta && meta.more)
      userLinks = links

      userLinks.forEach(function(link) {
        userMap[link._from] = true
      })

      for (var _id in userMap) {
        entityIds.push(_id)
      }

      if (options.log && links) {
        log('FindUsers: Total alerts found using links: ' + links.length)
      }

      doGetEntities()
    })
  }

  function doGetEntities() {
    if (entityIds.length === 0) return cb(err, [], extras)

    options.entityIds = entityIds

    /* Strip params that shouldn't pass through */
    delete options.cursor
    delete options.events

    getEntities(req, options, function(err, items) {
      if (err) return done(err)
      entities = items
      build()
    })
  }

  function build() {

    var alerts = []

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

      var event = 'watch_entity_place'
      if (to.visibility === 'private') {
        if (!link.enabled)
          event = 'request_watch_entity'
        else
          event = 'approve_watch_entity'
      }

      var trigger
      if (req.user._id === to._owner && req.user._id === from._owner)
        trigger = 'own_both'
      else if (req.user._id === to._owner)
        trigger = 'own_to'
      else if (req.user._id === from._owner)
        trigger = 'own_from'

      if (trigger) {
        var options = {
          event: event,
          to: to,
          from: from,
          link: link,
          trigger: trigger,
        }

        var alert = push.buildNotification(options)
        alerts.push(alert)
      }
    })

    cb(err, alerts || [], extras)
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, [], extras)
  }
}
