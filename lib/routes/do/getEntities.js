/**
 * routes/do/getEntities
 */

var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _link = {
  fields: {
    type:       { type: 'string', required: true },
    schema:     { type: 'string', required: true },
    links:      { type: 'boolean', default: false },
    count:      { type: 'boolean', default: true },
    where:      { type: 'object' },                                             // filter on link properties like _from
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
  entityIds:      { type: 'array', required: true },                    // array of strings
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

  var options = util.clone(req.body)
  run(req, options, function(err, entities) {
      if (err) return res.error(err)
      res.send({
        data: entities,
        date: util.getTimeUTC(),
        count: entities.length,
        more: false
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

  /* TODO: Need to add a check for bogus entity ids: wrong or missing collection, etc. */

  // if (options.entityIds.length === 0) {
  //   finish(proxErr.badValue('entityIds must contain at least one entityId'))
  // }

  var parts = { entities:[], links:[], entityIds:[], userIds:[], placeIds:[] }
  var activeLinkTypes = []
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

    async.forEach(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var entityIds = collectionMap[collectionName]
      var query = { _id:{ $in: entityIds }, enabled: true }
      db[collectionName]
        .find(query)
        .toArray(function(err, entities) {

        if (err) return next(err)
        processEntities(entities, next)
      })
    }

    function processEntities(entities, next) {
      if (entities.length > 0) {
        parts.entities.push.apply(parts.entities, entities)
        parts.entities.forEach(function(entity) {
          parts.entityIds.push(entity._id)
          parts.userIds.push(entity._creator)
          parts.userIds.push(entity._modifier)
          parts.userIds.push(entity._owner)
          if (entity._place) {
            parts.placeIds.push(entity._place)
          }
          if (entity._replyTo) {
            parts.userIds.push(entity._replyTo)
          }
        })
      }

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
        activeLinkTypes.push(activeLink.type)
        if (activeLink.links) {
          linkTypes.push(activeLink.type)
        }
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

    async.forEach(parts.entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      async.forEach(inActiveLinks, processLinkType, finish)

      function processLinkType(activeLink, next) {
        if (activeLink.limit === 0) return next()

        var query = {
          _to: entityId,
          type: activeLink.type,
          fromSchema: activeLink.schema,
        }

        if (activeLink.where) {
          query = { $and: [query, activeLink.where] }
        }

        db.links
          .find(query)
          .sort({ modifiedDate: -1 })
          .limit(activeLink.limit)
          .toArray(function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {
            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = links.length; i--;) {
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
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    var query = {
      _to: { $in: ids },
      type: { $in: inCountTypes },
      fromSchema: { $in: inCountSchemas }
    }

    var findOps = {countBy: ['_to', 'type', 'fromSchema', 'status']}

    db.links.safeFind(query, findOps, function(err, results) {
      if (err) return done(err)
      parts.linksInCounts = results
      addLinksOut()
    })
  }

  function addLinksOut() {
    if (options.log) log('addLinksOut')

    async.forEachSeries(parts.entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      async.forEachSeries(outActiveLinks, processLinkType, finish)

      function processLinkType(activeLink, next) {
        if (activeLink.limit === 0) return next()

        var query = {
          _from: entityId,
          type: activeLink.type,
          toSchema: activeLink.schema,
        }

        if (activeLink.where) {
          query = { $and: [query, activeLink.where] }
        }

        db.links
          .find(query)
          .sort({ modifiedDate: -1 })
          .limit(activeLink.limit)
          .toArray(function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {

            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = links.length; i--;) {
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
      _from: { $in: parts.entityIds },
      type: { $in: outCountTypes },
      toSchema: { $in: outCountSchemas }
    }

    var findOps = { countBy: ['_from', 'type', 'toSchema', 'status']}

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
      var query = {_entity:{ $in:parts.linkIds }, event:{ $in:['link_proximity', 'link_proximity_minus'] }}
      var findOps = {countBy: ['_entity', 'event'], asAdmin: true}

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

    async.forEach(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var entityIds = collectionMap[collectionName]
      var query = { _id:{ $in: entityIds }, enabled: true }

      db[collectionName]
        .find(query)
        .toArray(function(err, entities) {

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
    db.users
      .find({ _id: { $in: parts.userIds }, enabled: true})
      .toArray(function(err, users) {
      if (err) return done(err)

      parts.users = {}
      users.forEach(function(user) {
        parts.users[user._id] = user
      })
      addEntityPlaces()
    })
  }

  function addEntityPlaces() {
    if (options.log) log('addEntityPlaces')
    db.places
      .find({ _id: { $in: parts.placeIds }, enabled: true})
      .toArray(function(err, places) {
      if (err) return done(err)

      parts.places = {}
      places.forEach(function(place) {
        parts.places[place._id] = place
      })
      buildPayload()
    })
  }

  function buildPayload() {

    parts.entities.forEach(function(entity) {
      if (options.log) log('building payload', entity._id)

      if (options.links && options.links.active && options.links.active.length > 0) {
        if (parts.links) {
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
      if (entity._place) {
        entity.place = getEntityPlace(entity._place)
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
            _from: link._from,
            type: link.type,
            status: link.status,
            _owner: link._owner,
            targetSchema: link.fromSchema,
            inactive: link.inactive,
            stats: link.stats,
            sortDate: link.modifiedDate,
          }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._from]
          if (linkedEntity) {
            if (options.links.shortcuts) {
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

            if (!linkedEntity.system) {
              links.push(decoratedLink)
            }
          }
        }
      })
      return links
    }

    function getLinksOut(entityId, allLinks) {
      var links = []
      allLinks.forEach(function(link) {
        if (link._from === entityId && linkTypes.indexOf(link.type) > -1) {

          var decoratedLink = {
            _to: link._to,
            type: link.type,
            status: link.status,
            targetSchema: link.toSchema,
            _owner: link._owner,
            inactive: link.inactive,
            stats: link.stats,
            sortDate: link.modifiedDate,
          }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._to]
          if (linkedEntity) {
            if (options.links.shortcuts) {
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

            if (!linkedEntity.system) {
              links.push(decoratedLink)
            }
          }
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

      if (entity.schema === statics.schemaPlace) {
        if (!shortcut.photo && entity.category && entity.category.photo) {
          shortcut.photo = entity.category.photo
          shortcut.photo.colorize = true
          shortcut.photo.colorizeKey = entity.category.name
        }
        if (entity.location) {
          shortcut.location = { lat: entity.location.lat, lng: entity.location.lng }
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
            linkCounts.push({ type: linkCount.type, schema: linkCount.fromSchema, status: linkCount.status, count: linkCount.countBy })
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
            linkCounts.push({ type: linkCount.type, schema: linkCount.toSchema, status: linkCount.status, count: linkCount.countBy })
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

    function getEntityPlace(placeId) {
      if (parts.places) {
        var place = parts.places[placeId]
        if (place) {
          var result = { _id: place._id, photo: place.photo, name: place.name, schema: place.schema }
          if (!result.photo && place.category && place.category.photo) {
            result.photo = place.category.photo
            result.photo.colorize = true
            result.photo.colorizeKey = place.category.name
          }
          return result
        }
      }
    }
  }

  function done(err) {
    if (err) logErr(err.stack || err)
    cb(err, parts.entities)
  }
}

exports.main.anonOk = true
