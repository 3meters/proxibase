/*
 * getActivities
 */

var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */


var _body = {
  events:       { type: 'array', required: true },
  cursor:       { type: 'object', value: {
    linkTypes:    { type: 'array' },                                              // link types to include
    schemas:      { type: 'array' },                                              // schemas to include
    sort:         { type: 'object', default: { modifiedDate: -1 }},
    skip:         { type: 'number', default: 0 },
    limit:        { type: 'number', default: statics.optionsLimitDefault,  // applied per entity type
      validate: function(v) {
        if (v > statics.optionsLimitMax) {
          return 'Max entity limit is ' + statics.optionsLimitMax
        }
        return null
      },
    },
  }},
}

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.cursor.linkTypes && !req.body.cursor.schemas) {
    return res.error(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var options = util.clone(req.body)

  run(req, options, function(err, activities, extras) {
      if (err) return res.error(err)
      res.send({
        data: activities,
        date: util.getTimeUTC(),
        count: activities.length,
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

  // Only run for the logged-in user
  options.entityId = req.user._id

  if (!options.cursor.linkTypes && !options.cursor.schemas) {
    return done(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var activityLinks = []
  var activityIds = []
  var actions = []
  var activities = []
  var entityIds = []
  var userIds = []
  var actionEntities = {}
  var actionUsers = {}
  var extras = { more: false }

  findActivityLinks()

  function findActivityLinks() {
    log('findActivityLinks')

    var query = {
      _from: options.entityId,
      toSchema: { $in: req.body.cursor.schemas },
      type: { $in: req.body.cursor.linkTypes },
    }

    db.links.find(query, { type: true, _to: true }).toArray(function(err, links) {
      if (err) return done(err)
      var linkToMap = {}

      activityLinks.push.apply(activityLinks, links)
      activityLinks.forEach(function(link) {
        linkToMap[link._to] = link._to
      })

      for (var propertyName in linkToMap) {
        activityIds.push(linkToMap[propertyName])
      }
      getActivityActions()
    })
  }

  function getActivityActions() {
    log('getActivityActions')
    var query = {
      $or: [
        { _user: { $in: activityIds }},
        { _entity: { $in: activityIds }},
        { _toEntity: { $in: activityIds }},
      ]
    }
    query = { $and: [query, { _user: { $ne: options.entityId }}, { event: { $in: options.events }}] }

    var pipe = [
      { $match: query },
      { $sort: options.cursor.sort },
      { $group: {
        _id: { _entity: "$_entity" },
        lastActivityDate: { $max: "$modifiedDate" },
        actions: { $push: { event: "$event", _user: "$_user", _toEntity: "$_toEntity", _fromEntity: "$_fromEntity", modifiedDate: "$modifiedDate" }},
        count: { $sum: 1 }}},
      { $sort: { lastActivityDate: -1 }},
      { $skip: options.cursor.skip },
      { $limit: options.cursor.limit + (options.cursor.limit === 0 ? 0 : 1) },
    ]

    db.actions.aggregate(pipe, function(err, docs) {
      if (err) return done(err)
      log('docs returned', docs.length)

      if (docs.length > options.cursor.limit) {
        docs.pop()
        extras.more = true
      }

      docs.forEach(function(doc) {
        var lastAction = doc.actions[0]
        var action = {
          event: lastAction.event,
          _user: lastAction._user,
          _entity: doc._id._entity,
          _toEntity: lastAction._toEntity,
          _fromEntity: lastAction._fromEntity,
          modifiedDate: lastAction.modifiedDate,
          count: doc.count,
        }
        if (doc.count > 1) action.grouped = true
        actions.push(action)
      })

      gatherEntityIds()
    })
  }

  function gatherEntityIds() {
    log('gatherEntityIds')
    var entityMap = {}

    actions.forEach(function(action) {
      if (action._entity) {
        entityMap[action._entity] = action._entity
      }
      if (action._toEntity) {
        entityMap[action._toEntity] = action._toEntity
      }
      if (action._fromEntity) {
        entityMap[action._fromEntity] = action._fromEntity
      }
    })

    for (var propertyName in entityMap) {
      entityIds.push(entityMap[propertyName])
    }
    gatherUserIds()
  }

  function gatherUserIds() {
    log('gatherUserIds')
    var userMap = {}

    actions.forEach(function(action) {
      if (action._user) {
        userMap[action._user] = action._user
      }
    })

    for (var propertyName in userMap) {
      userIds.push(userMap[propertyName])
    }
    addActionEntities()
  }

  function addActionEntities() {
    log('addActionEntities')
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit
     * the number of child entities that get returned to the caller.
     */
    var collectionMap = methods.mapIdsByCollection(entityIds)
    var collectionNames = []
    for (var collectionName in collectionMap) {
      collectionNames.push(collectionName)
    }

    async.forEach(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var collectionIds = collectionMap[collectionName]
      var query = { _id:{ $in: collectionIds }, enabled: true }

      db[collectionName]
        .find(query)
        .toArray(function(err, entities) {

        if (err) return next(err)
        /*
         * This map includes all linked entities which later is used to
         * assign each to appropriate parent.
         */
        entities.forEach(function(entity) {
          actionEntities[entity._id] = entity
        })
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)
      addActionUsers()
    }
  }

  function addActionUsers() {
    log('addActionUsers')
    db.users
      .find({ _id: { $in: userIds }, enabled: true})
      .toArray(function(err, users) {
      if (err) return done(err)

      users.forEach(function(user) {
        actionUsers[user._id] = user
      })
      assembleActivities()
    })
  }

  function assembleActivities() {
    log('assembleActivities')
    actions.forEach(function(action) {
      var actionEntity
      var activity = {
        trigger: activityTrigger(action),
        action: { event: action.event },
        sortOrder: action.modifiedDate,
        activityDate: action.modifiedDate,
      }

      if (action._entity) {
        actionEntity = actionEntities[action._entity]
        activity.action.entity = {
          id: actionEntity._id,
          name: actionEntity.name,
          description: actionEntity.description,
          category: actionEntity.category,
          photo: actionEntity.photo,
          ownerId: actionEntity._owner,
          schema: actionEntity.schema,
          type: actionEntity.type,
        }
      }
      if (action._toEntity) {
        actionEntity = actionEntities[action._toEntity]
        activity.action.toEntity = {
          id: actionEntity._id,
          name: actionEntity.name,
          category: actionEntity.category,
          photo: actionEntity.photo,
          schema: actionEntity.schema,
        }
      }
      if (action._user) {
        var actionUser = actionUsers[action._user]
        activity.action.user = {
          id: actionUser._id,
          photo: actionUser.photo,
          area: actionUser.area,
          name: actionUser.name
        }
      }
      /*
       * Add summary info.
       */
      if (action.grouped) {
        if (activity.action.event.indexOf('move') !== -1) {
          activity.grouped = true
          activity.summary = 'More places visited...'
        }
        else if (activity.action.event.indexOf('forward') !== -1) {
          activity.grouped = true
          activity.summary = 'More places...'
        }
      }

      /*
       * Check for basic completeness
       */
      if (activity.action
          && activity.action.event
          && activity.action.user
          && activity.action.entity) {
          activities.push(activity)
      }
      else {
        logErr('activity is incomplete, not included: ', activity)
      }
    })

    done()
  }

  function activityTrigger(action) {
    var watch
    var create
    var user

    activityLinks.forEach(function(link) {
      if (action._user === link._to) user = 'watch_user'
      if (action._toEntity === link._to && link.type === statics.typeWatch) watch = 'watch_to'
      if (action._entity === link._to && link.type === statics.typeWatch) watch = 'watch'
      if (action._toEntity === link._to && link.type === statics.typeCreate) create = 'own_to'
      if (action._entity === link._to && link.type === statics.typeCreate) create = 'own'
    })

    if (create) return create
    if (watch) return watch
    if (user) return user
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, activities || [], extras)
  }
}
