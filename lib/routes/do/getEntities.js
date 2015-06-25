/**
 * routes/do/getEntities
 *    author:  JayMa
 */

var async = require('async')
var methods = require('./methods')
var joinLimit = util.statics.db.limits.join


/* Request body template start ========================================= */

var _link = {
  fields: {
    type:       { type: 'string', required: true },
    schema:     { type: 'string', required: true },
    // links:      { type: 'boolean', default: false },   //  This is a noop -- removed
    count:      { type: 'boolean', default: true },
    where:      { type: 'object' },                                      // filter on link properties like _from
    direction:  { type: 'string', default: 'both', value: 'in|out|both' },
    limit:      { type: 'number', default: statics.db.limits.default,    // always the top n based on modifiedDate
      validate: function(v) {
        if (v > statics.db.limits.max) {
          return 'Max entity limit is ' + statics.db.limits.max
        }
        return null
      },
    },
  }
}

var _body = {
  entityIds:      { type: 'array', required: true },             // array of strings
  where:          { type: 'object' },                            // filter on entity properties like activityDate
  links:          { type: 'object', value: {
    shortcuts:      { type: 'boolean', default: true },
    active:         { type: 'array', value: _link.fields },
  }},
  log:            { type: 'boolean' },
}

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var options = _.cloneDeep(req.body)
  run(req, options, function(err, entities, more) {
    if (err) return res.error(err)
    res.send({
      data: entities,
      date: util.getTimeUTC(),
      count: entities.length,
      more: more
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
  if (err) return done(err, [])

  // Sort is hard-coded, don't allow callers to specify it, could use scrub {strict: true}
  if (options.links && options.links.active) {
    var errors = options.links.active.filter(function(linkSpec) {
      return (linkSpec.sort)
    })
    if (errors.length) {
      return cb(perr.badParam('links.active.sort not supported: always modifiedDate: -1'))
    }
  }

  /* TODO: Need to add a check for bogus entity ids: wrong or missing collection, etc. */

  var parts = { entities:[], links:[], entityIds:[], userIds:[], patchIds:[],
                linkedIds: [], linkIds: [], more: false }
  var lookupTypes = []
  var inCountTypes = []
  var outCountTypes = []
  var inCountSchemas = []
  var outCountSchemas = []
  var linkTypes = []
  var inTypes = []
  var outTypes = []
  var inActiveLinks = []
  var outActiveLinks = []

  addEntities()

  function addEntities() {
    if (options.log) log('addEntities')

    var collectionMap = methods.mapIdsByCollection(options.entityIds)
    var collectionNames = []
    for (var collectionName in collectionMap) {
      collectionNames.push(collectionName)
    }

    async.each(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var entityIds = collectionMap[collectionName]
      var query = {}

      if (!entityIds.length) return next()

      // SafeFindOne will check acl-based permissions
      if (entityIds.length === 1) {

        query = _.extend({_id: entityIds[0]}, options.where)

        db[collectionName].safeFindOne(query, req.dbOps, function(err, entity) {
          if (err) return next(err)
          var entities = []
          if (entity) entities.push(entity)
          return processEntities(entities, next)
        })
      }

      // SafeFind does not check acl-based perms
      else {

        query = _.extend({_id: { $in: _.uniq(entityIds) }}, options.where)

        /* Defaults to statics.db.limits.default if we don't set this */
        req.dbOps.limit = statics.db.limits.max

        db[collectionName].safeFind(query, req.dbOps, function(err, entitiesUnsorted) {
          if (err) return next(err)

          // return the collection in the same order as the
          // array of ids passed in.
          var entities = []
          entitiesUnsorted.forEach(function(entity) {
            entities[entityIds.indexOf(entity._id)] = entity
          })

          processEntities(entities, next)
        })
      }
    }

    function processEntities(entities, next) {

      entities.forEach(function(entity) {
        parts.entities.push(entity)
        parts.entityIds.push(entity._id)
        parts.userIds.push(entity._creator)
        parts.userIds.push(entity._modifier)
        parts.userIds.push(entity._owner)
        if (entity._acl) {
          parts.patchIds.push(entity._acl)
        }
        if (entity._replyTo) {
          parts.userIds.push(entity._replyTo)
        }
      })
      next()
    }

    function finish(err) {
      if (err) return done(err)
      if (options.log) log('entities found: ' + parts.entities.length)
      if (parts.entities.length === 0) return done()
      prepLinks()
    }
  }

  function prepLinks() {
    if (options.log) log('prepLinks')

    if (!options.links || !options.links.active || options.links.active.length === 0) {
      addEntityUsers()
    }
    else {
      options.links.active.forEach(function(activeLink) {
        /**
         * I don't think this does what it says it does -- george
        if (activeLink.links) {
          linkTypes.push(activeLink.type)
        }
        */
        linkTypes.push(activeLink.type)
        if (options.links.shortcuts) {
          lookupTypes.push(activeLink.type)
        }
        if (activeLink.direction === 'both' || activeLink.direction === 'in') {
          inTypes.push(activeLink.type)
          inActiveLinks.push(activeLink)
          if (activeLink.count) {
            inCountTypes.push(activeLink.type)
            inCountSchemas.push(activeLink.schema)
          }
        }
        if (activeLink.direction === 'both' || activeLink.direction === 'out') {
          outTypes.push(activeLink.type)
          outActiveLinks.push(activeLink)
          if (activeLink.count) {
            outCountTypes.push(activeLink.type)
            outCountSchemas.push(activeLink.schema)
          }
        }
      })
      addLinksIn()
    }
  }

  function addLinksIn() {
    if (options.log) log('addLinksIn')

    async.each(parts.entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      async.each(inActiveLinks, processLinkType, finish)

      function processLinkType(activeLink, next) {
        if (activeLink.limit === 0) return next()

        var query = {
          _to: entityId,
          type: activeLink.type,
          fromSchema: activeLink.schema,
        }

        query = _.extend(query, activeLink.where)

        var ops = _.cloneDeep(req.dbOps)
        ops.sort = {modifiedDate: -1}  // TODO: this should be default not override
        ops.skip = activeLink.skip
        ops.limit = activeLink.limit


        db.links.safeFind(query, ops, function(err, links) {
          if (err) return next(err)

          if (links.length !== 0) {
            for (var i = 0; i < links.length; i++) {
              parts.links.push(links[i])
              parts.linkIds.push(links[i]._id)
              if (lookupTypes.indexOf(links[i].type) > -1) {
                parts.linkedIds.push(links[i]._from)
              }
            }
          }
          next()
        })
      }
      function finish(err) {
        if (err) return next(err)
        next()
      }

    }
    function finish(err) {
      if (err) return done(err)
      addLinksInCounts()
    }
  }

  function addLinksInCounts() {
    if (options.log) log('addLinksInCounts')
    var ids = []
    // See http://stackoverflow.com/questions/1374126/how-to-append-an-array-to-an-existing-javascript-array
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    var query = {
      _to: { $in: _.uniq(ids) },
      type: { $in: _.uniq(inCountTypes) },
      fromSchema: { $in: _.uniq(inCountSchemas) }
    }

    var findOps = {countBy: ['_to', 'type', 'fromSchema', 'enabled']}

    db.links.safeFind(query, findOps, function(err, results) {
      if (err) return done(err)

      parts.linksInCounts = results
      addLinksOut()
    })
  }

  function addLinksOut() {
    if (options.log) log('addLinksOut')

    async.each(parts.entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      async.each(outActiveLinks, processLinkType, finish)

      function processLinkType(activeLink, next) {
        if (activeLink.limit === 0) return next()

        var query = {
          _from: entityId,
          type: activeLink.type,
          toSchema: activeLink.schema,
        }

        query = _.extend(query, activeLink.where)

        var ops = _.cloneDeep(req.dbOps)
        ops.sort = {modifiedDate: -1}  // TODO: this should be default, not override
        ops.skip = activeLink.skip
        ops.limit = activeLink.limit

        db.links.safeFind(query, ops, function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {

            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = 0; i < links.length; i++) {
              parts.links.push(links[i])
              parts.linkIds.push(links[i]._id)
              if (lookupTypes.indexOf(links[i].type) > -1) {
                parts.linkedIds.push(links[i]._to)
              }
            }
          }
          next()
        })
      }
      function finish(err) {
        if (err) return done(err)
        next()
      }

    }
    function finish(err) {
      if (err) return done(err)
      addLinksOutCounts()
    }
  }

  function addLinksOutCounts() {
    if (options.log) log('addLinksOutCounts')

    req.collection = db.links
    var query = {
      _from: { $in: _.uniq(parts.entityIds) },
      type: { $in: _.uniq(outCountTypes) },
      toSchema: { $in: _.uniq(outCountSchemas) }
    }

    var findOps = { countBy: ['_from', 'type', 'toSchema', 'enabled']}

    db.links.safeFind(query, findOps, function(err, results) {
      if (err) return done(err)
      parts.linksOutCounts = results
      addLinkStats()
    })
  }

  function addLinkStats() {
    if (options.log) log('addLinkStats')
    if (!parts.linkIds) {
      addEntityUsers()
    }
    else {
      var query = {_entity:{ $in: _.uniq(parts.linkIds) }, event:{ $in:['link_proximity', 'link_proximity_minus'] }}
      var findOps = {countBy: ['_entity', 'event'], asAdmin: true, limit: joinLimit}


      db.actions.safeFind(query, findOps, function(err, results) {
        if (err) return done(err)
        parts.stats = results
        addLinkedEntities()
      })
    }
  }

  function addLinkedEntities() {
    if (options.log) log('addLinkedEntities')
    parts.linkedEntities = {}
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit
     * the number of child entities that get returned to the caller.
     */
    var collectionMap = methods.mapIdsByCollection(parts.linkedIds)
    var collectionNames = []
    for (var collectionName in collectionMap) {
      collectionNames.push(collectionName)
    }

    async.each(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var entityIds = collectionMap[collectionName]

      var query = { _id:{ $in: _.uniq(entityIds) }}

      var ops = _.cloneDeep(req.dbOps)
      ops.limit = joinLimit

      db[collectionName].safeFind(query, ops, function(err, entities) {

        if (err) return next(err)
        /*
         * This map includes all linked entities which later is used to
         * assign each to appropriate parent.
         */
        entities.forEach(function(linkedEntity) {
          parts.linkedEntities[linkedEntity._id] = linkedEntity
          parts.userIds.push(linkedEntity._creator)
          parts.userIds.push(linkedEntity._modifier)
          parts.userIds.push(linkedEntity._owner)
        })
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)
      var size = 0
      for (var key in parts.linkedEntities) {
        if (parts.linkedEntities.hasOwnProperty(key)) size++
      }
      addEntityUsers()
    }
  }

  function addEntityUsers() {
    if (options.log) log('addEntityUsers')
    var query = { _id: { $in: _.uniq(parts.userIds) }}
    var ops = _.cloneDeep(req.dbOps)
    ops.limit = joinLimit

    db.users.safeFind(query, ops, function(err, users) {
      if (err) return done(err)

      parts.users = {}
      users.forEach(function(user) {
        parts.users[user._id] = user
      })
      addEntityPatches()
    })
  }

  function addEntityPatches() {
    if (options.log) log('addEntityPatches')
    var query = { _id: { $in: _.uniq(parts.patchIds) }}
    var ops = _.cloneDeep(req.dbOps)
    ops.limit = joinLimit
    db.patches.safeFind(query, ops, function(err, patches) {
      if (err) return done(err)

      parts.patches = {}
      patches.forEach(function(patch) {
        parts.patches[patch._id] = patch
      })
      buildPayload()
    })
  }

  function buildPayload() {

    parts.entities.forEach(function(entity) {
      if (options.log) log('building payload', entity._id)

      if (options.links && options.links.active && options.links.active.length > 0) {
        if (parts.links && options.links && options.links.shortcuts) {
          var linksIn = getLinksIn(entity._id, parts.links)
          var linksOut = getLinksOut(entity._id, parts.links)
          if (linksIn.length > 0) entity.linksIn = linksIn
          if (linksOut.length > 0) entity.linksOut = linksOut
        }

        if (parts.linksInCounts) {
          var linksInCounts = getlinksInCounts(entity._id) /* Link counts: comments, likers, applinks, posts, watchers */
          if (linksInCounts.length > 0) entity.linksInCounts = linksInCounts
        }

        if (parts.linksOutCounts) {
          var linksOutCounts = getlinksOutCounts(entity._id) /* Link counts: proximity */
          if (linksOutCounts.length > 0) entity.linksOutCounts = linksOutCounts
        }
      }

      entity.creator = getEntityUser(entity._creator)
      entity.modifier = getEntityUser(entity._modifier)
      entity.owner = getEntityUser(entity._owner)
      if (entity._acl) {
        entity.patch = getEntityPatch(entity._acl)
      }
      if (entity._replyTo) {
        entity.replyTo = getEntityUser(entity._replyTo)
      }

      /* Temp fixup */
      if (entity.schema === statics.schemaApplink) {
        if (entity.type == 'twitter') {
          entity.photo = {
            prefix: "twitter.png",
            source: "assets.applinks",
          }
        }
      }

    })

    /* Wrap it up */
    done()

    function getLinksIn(entityId, allLinks) {
      var links = []
      allLinks.forEach(function(link) {
        if (link._to === entityId && linkTypes.indexOf(link.type) > -1) {

          var decoratedLink = {
            _id: link._id,
            _from: link._from,
            type: link.type,
            enabled: link.enabled,
            _owner: link._owner,
            _creator: link._creator,
            targetSchema: link.fromSchema,
            stats: link.stats,
            sortDate: link.modifiedDate,
          }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._from]
          if (linkedEntity && options.links.shortcuts) {
            if (!linkedEntity.position && link.position) {
              linkedEntity.position = link.position
            }
            decoratedLink.shortcut = makeShortcut(linkedEntity)
            decoratedLink.shortcut.sortDate = decoratedLink.sortDate
          }

          /* Get link stats */
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._entity == link._id) {
              decoratedLink.stats = decoratedLink.stats || []
              decoratedLink.stats.push({ event: parts.stats[i].event, count: parts.stats[i].countBy })
            }
          }

          links.push(decoratedLink)
        }
      })
      return links
    }

    function getLinksOut(entityId, allLinks) {
      var links = []
      allLinks.forEach(function(link) {
        if (link._from === entityId && linkTypes.indexOf(link.type) > -1) {

          var decoratedLink = {
            _id: link._id,
            _to: link._to,
            type: link.type,
            targetSchema: link.toSchema,
            _owner: link._owner,
            _creator: link._creator,
            stats: link.stats,
            sortDate: link.modifiedDate,
          }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._to]
          if (linkedEntity && options.links.shortcuts) {
            decoratedLink.shortcut = makeShortcut(linkedEntity)
            decoratedLink.shortcut.sortDate = decoratedLink.sortDate
          }

          /* Get link stats */
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._entity == link._id) {
              decoratedLink.stats = decoratedLink.stats || []
              decoratedLink.stats.push({ event: parts.stats[i].event, count: parts.stats[i].countBy })
            }
          }

          links.push(decoratedLink)
        }
      })
      return links
    }

    function makeShortcut(entity) {
      var shortcut = {
        id: entity._id,
        name: entity.name,
        photo: entity.photo,
        schema: entity.schema,
        type: entity.type,
        app: entity.schema,
        content: true,
        action: 'view',
      }

      if (entity._creator) {
        shortcut.creator = getEntityUser(entity._creator)
      }

      if (entity.location) {
        shortcut.location = { lat: entity.location.lat, lng: entity.location.lng }
      }

      if (entity.schema === statics.schemaApplink) {
        shortcut.content = false
        shortcut.app = entity.type
        shortcut.appId = entity.appId
        shortcut.appUrl = entity.appUrl
        shortcut.validatedDate = entity.validatedDate
        shortcut.position = entity.position
        if (!shortcut.name) {
          shortcut.name = entity.type
        }
        if (!shortcut.photo) {
          shortcut.photo = { prefix: shortcut.app + '.png', source: 'assets.applinks' };
        }
        /* Temp fixup because twitter images are not public anymore */
        if (entity.type == 'twitter') {
          shortcut.photo.prefix = "twitter.png"
          shortcut.photo.source = "assets.applinks"
        }
        // Need these for testing
        shortcut.origin = entity.origin
        shortcut.originId = entity.originId
      }

      if (entity.schema === statics.schemaPatch) {
        if (entity.location) {
          shortcut.location = { lat: entity.location.lat, lng: entity.location.lng }
        }
        shortcut.subtitle = entity.subtitle
        if (!shortcut.subtitle && entity.category && entity.category.name) {
          shortcut.subtitle = entity.category.name
        }
      }
      if (entity.schema === statics.schemaMessage) {
        shortcut.description = entity.description
      }
      return shortcut
    }

    function getlinksInCounts(entityId) {
      var linkCounts = []
      if (parts.linksInCounts) {
        parts.linksInCounts.forEach(function(linkCount) {
          if (linkCount._to === entityId) {
            linkCounts.push({ type: linkCount.type, schema: linkCount.fromSchema, enabled: linkCount.enabled, count: linkCount.countBy })
          }
        })
      }
      return linkCounts
    }

    function getlinksOutCounts(entityId) {
      var linkCounts = []
      if (parts.linksOutCounts) {
        parts.linksOutCounts.forEach(function(linkCount) {
          if (linkCount._from === entityId) {
            linkCounts.push({ type: linkCount.type, schema: linkCount.toSchema, enabled: linkCount.enabled, count: linkCount.countBy })
          }
        })
      }
      return linkCounts
    }

    function getEntityUser(userId) {
      if (parts.users) {
        var user = parts.users[userId]
        if (user && user._id) {
          return { _id: user._id, photo: user.photo, area: user.area, name: user.name, schema: user.schema }
        }
      }
    }

    function getEntityPatch(patchId) {
      if (parts.patches) {
        var patch = parts.patches[patchId]
        if (patch) {
          var result = { _id: patch._id, photo: patch.photo, name: patch.name, schema: patch.schema }
          return result
        }
      }
    }
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, parts.entities, parts.more)
  }
}

exports.main.anonOk = true
