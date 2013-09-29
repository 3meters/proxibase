/**
 * routes/do/getEntities
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var link = {
  fields: {
    type:       { type: 'string', required: true },                                            
    schema:     { type: 'string', required: true },                                            
    links:      { type: 'boolean', default: false },
    count:      { type: 'boolean', default: true },
    where:      { type: 'object' },                                             // filter on link properties like _from
    direction:  { type: 'string', default: 'both' },
    inactive:   { type: 'boolean', default: false },                            // include inactive links, inactive links never included in counts
    limit:      { type: 'number', default: util.statics.optionsLimitDefault,    // always the top n based on modifiedDate
      value: function(v) {
        if (v > util.statics.optionsLimitMax) {
          return 'Max entity limit is ' + util.statics.optionsLimitMax
        }
        return null
      },
    },
  }
}

var _body = {
  entityIds:      { type: 'array', required: true },                    // array of strings
  links:          { type: 'object', default: { sort: { modifiedDate: -1 }}, value: {
    shortcuts:      { type: 'boolean', default: true },
    loadSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    loadWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects
    active:         { type: 'array', value: link.fields },
  }},
}

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = util.check(req.body, _body)
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

  var err = util.check(options, _body)
  if (err) return cb(err, [])

  /* TODO: Need to add a check for bogus entity ids: wrong or missing collection, etc. */

  // if (options.entityIds.length == 0) {
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
    log('addEntities')

    var collectionMap = methods.mapIdsByCollection(options.entityIds)
    var collectionNames = []
    for (var collectionName in collectionMap) {
      collectionNames.push(collectionName)
    }

    async.forEach(collectionNames, processCollection, finish)

    function processCollection(collectionName, next) {
      var entityIds = collectionMap[collectionName]
      var query = { _id:{ $in: options.entityIds }, enabled: true }
      db[collectionName]
        .find(query)
        .toArray(function(err, entities) {

        if (err) return next(err)

        if (entities.length > 0) {
          parts.entities.push.apply(parts.entities, entities)
          parts.entities.forEach(function(entity) {
            parts.entityIds.push(entity._id)
            parts.userIds.push(entity._creator)
            parts.userIds.push(entity._modifier)
            if (entity._place) {
              parts.placeIds.push(entity._place)
            }
          })
        }
        next()
      })
    }

    function finish(err) {
      if (err) return done(err)
      if (parts.entities.length == 0) return done()
      prepLinks()
    }
  }

  function prepLinks() {
    log('prepLinks')

    if (!options.links || !options.links.active || options.links.active.length == 0) {
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
    log('addLinksIn')

    async.forEach(parts.entityIds, processEntity, finish)        

    function processEntity(entityId, next) {

      async.forEach(inActiveLinks, processLinkType, finish)        

      function processLinkType(activeLink, next) {
        var query = { 
          _to: entityId, 
          type: activeLink.type,
          fromSchema: activeLink.schema,
        }

        if (!activeLink.inactive) {
          query.inactive = false;
        }
        if (activeLink.where) {
          query = { $and: [query, activeLink.where] }
        }

        db.links
          .find(query)
          .sort({ modifiedDate: 1 })
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
      parts.links.length > 0 ? addLinksInCounts() : addLinksOut()
    }
  }  

  function addLinksInCounts() {
    log('addLinksInCounts')
    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    var query = { 
      _to: { $in: ids },
      type: { $in: inCountTypes },
      fromSchema: { $in: inCountSchemas },
      inactive: false,
    }

    req.query = {countBy: ['_to', 'type', 'fromSchema'], find: query}

    db.links.safeFind(req.query, function(err, results) {
      if (err) return done(err)
      parts.linksInCounts = results.data
      addLinksOut()
    })
  }

  function addLinksOut() {
    log('addLinksOut')

    async.forEachSeries(parts.entityIds, processEntity, finish)

    function processEntity(entityId, next) {

      async.forEachSeries(outActiveLinks, processLinkType, finish)

      function processLinkType(activeLink, next) {
        var query = { 
          _from: entityId, 
          type: activeLink.type,
          toSchema: activeLink.schema,
        } 

        log('out link query: ' + JSON.stringify(query))

        if (!activeLink.inactive) {
          query.inactive = false;
        }        
        if (activeLink.where) {
          query = { $and: [query, activeLink.where] }
        }

        db.links
          .find(query)
          .sort({ modifiedDate: 1 })
          .limit(activeLink.limit)
          .toArray(function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {

            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = links.length; i--;) {
              log('link type = ' + links[i].type + ', fromSchema = ' + links[i].fromSchema + ', toSchema = ' + links[i].toSchema)

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
        if (err) return res.error(err)
        next()
      }

    }
    function finish(err) {
      if (err) return done(err)
      parts.links.length > 0 ? addLinksOutCounts() : addLinkStats()
    }
  }  

  function addLinksOutCounts() {
    log('addLinksOutCounts')
    
    req.collection = db.links
    var query = { 
      _from: { $in: parts.entityIds },
      type: { $in: outCountTypes },
      toSchema: { $in: outCountSchemas },
      inactive: false,
    }

    req.query = { countBy: ['_from', 'type', 'toSchema'], find: query}

    db.links.safeFind(req.query, function(err, results) {
      if (err) return done(err)
      parts.linksOutCounts = results.data
      addLinkStats()
    })
  }

  function addLinkStats() {
    log('addLinkStats')
    if (!parts.linkIds) {
      addEntityUsers()
    }
    else {
      req.query = {
        countBy: ['_target', 'type'],
        find: { _target:{ $in:parts.linkIds }, type:{ $in:['link_proximity', 'link_proximity_minus'] }}
      }

      //req.query = {countBy: ['_target'], find:{ _target:{ $in:parts.linkIds } }}

      db.actions.safeFind(req.query, function(err, results) {
        if (err) return done(err)
        parts.stats = results.data
        addLinkedEntities()
      })
    }
  }

  function addLinkedEntities() {
    log('addLinkedEntities')
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

      if (options.links.loadWhere) {
        query = { $and: [query, options.links.loadWhere] }
      }
      db[collectionName]
        .find(query)
        .sort(options.links.loadSort)
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
    log('addEntityUsers')
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
    log('addEntityPlaces')
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
      log('building payload for ' + entity._id)

      var activeLinksLimited = []

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
      if (entity._place) {
        entity.place = getEntityPlace(entity._place)
      }

      /* Temp fixup */
      if (entity.schema === util.statics.schemaApplink) {
        if (entity.type == 'twitter') {
          entity.photo = { 
            prefix: "twitter.png", 
            source: "assets",
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

          var decoratedLink = { _from: link._from, type: link.type, schema: link.fromSchema, strong: link.strong, inactive: link.inactive, stats: link.stats, modifiedDate: link.modifiedDate }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._from]
          if (linkedEntity) {
            if (options.links.shortcuts) {
              decoratedLink.shortcut = makeShortcut(linkedEntity)
            }

            /* Get link stats */
            for (var i = 0; i < parts.stats.length; i++) {
              if (parts.stats[i]._target == link._id) {
                decoratedLink.stats = decoratedLink.stats || []
                decoratedLink.stats.push({ type:parts.stats[i].type, count:parts.stats[i].countBy })
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
          
          var decoratedLink = { _to: link._to, type: link.type, schema: link.toSchema, strong: link.strong, inactive: link.inactive, stats: link.stats, modifiedDate: link.modifiedDate }
          if (link.proximity) decoratedLink.proximity = link.proximity

          /* Add enough to the link to show a shortcut with icon, etc. */
          var linkedEntity = parts.linkedEntities[link._to]
          if (linkedEntity) {
            if (options.links.shortcuts) {
              decoratedLink.shortcut = makeShortcut(linkedEntity) 
            }

            /* Get link stats */
            for (var i = 0; i < parts.stats.length; i++) {
              if (parts.stats[i]._target == link._id) {
                decoratedLink.stats = decoratedLink.stats || []
                decoratedLink.stats.push({ type:parts.stats[i].type, count:parts.stats[i].countBy })
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
        modifiedDate: entity.modifiedDate,  // so clients can order shortcuts by recent activity
        app: entity.schema,
        content: true,
        action: 'view',
      }
      if (entity.location) {
        shortcut.location = { lat: entity.location.lat, lng: entity.location.lng }
      }
      if (entity.schema === util.statics.schemaApplink) {
        shortcut.content = false
        shortcut.app = entity.type
        shortcut.appId = entity.appId
        shortcut.appUrl = entity.appUrl
        shortcut.position = entity.position
        if (!shortcut.name) {
          shortcut.name = entity.type
        }
        if (!shortcut.photo) {
          shortcut.photo = { prefix: '/img/applinks/' + shortcut.app + '.png', source: 'assets' };
        }
        if (entity.type == 'twitter') {
          shortcut.photo.prefix = "/img/applinks/twitter.png"
          shortcut.photo.source = "assets"
        }
      }
      if (entity.schema === util.statics.schemaPlace) {
        if (!shortcut.photo && entity.category && entity.category.photo) {
          shortcut.photo = entity.category.photo
          shortcut.photo.colorize = true
          shortcut.photo.colorizeKey = entity.category.name
        }
        if (entity.location) {
          shortcut.location = { lat: entity.location.lat, lng: entity.location.lng }
        }
      }
      return shortcut
    }

    function getlinksInCounts(entityId) {
      var linkCounts = []
      if (parts.linksInCounts) {
        parts.linksInCounts.forEach(function(linkCount) {
          if (linkCount._to === entityId) {
            linkCounts.push({ type: linkCount.type, schema: linkCount.fromSchema, count: linkCount.countBy })
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
            linkCounts.push({ type: linkCount.type, schema: linkCount.toSchema, count: linkCount.countBy })
          }
        })
      }
      return linkCounts
    }

    function getEntityUser(userId) {
      if (parts.users) {
        var user = parts.users[userId]
        if (user != null) {
          result = {_id:user._id, photo:user.photo, area:user.area, name:user.name}
          return result
        }
      }
    }

    function getEntityPlace(placeId) {
      if (parts.places) {
        var place = parts.places[placeId]
        if (place != null) {
          result = { _id: place._id, photo: place.photo, name: place.name, schema: place.schema }
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
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
