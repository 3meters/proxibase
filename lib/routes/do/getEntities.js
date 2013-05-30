/**
 * routes/do/getEntities
 */

var db = util.db
var async = require('async')
var data = require('../data')

/* Public web service */
exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var activeLink = {
    fields: {    
      type:       { type: 'string', required: true },                                            
      links:      { type: 'boolean', default: false },
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      direction:  { type: 'string', default: 'both' },
      limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
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
    entityIds:      { type: 'array', required: true },                  // array of strings
    entityType:     { type: 'string', default: 'entities' },            // by table: users, entities
    linkSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    linkWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects    
    activeLinks:    { type: 'array', value: activeLink.fields },
    registrationId: { type: 'string' },
    subqueries:     { type: 'boolean', default: false },
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  updateDevice()

  /*
   * If the query is for beacon entities then it is a good opportunity to
   * update the beacon array that is currently associated with the device. 
   * The beacon array is used to determine 'nearby" for notifications.
   * If a registrationId is passed, we assume the entity ids are for beacon entities.
   */
  function updateDevice() {
    if (req.body.entityType !== 'entities' || !req.body.registrationId) {
      doEntities()
    }
    else {
      log('Updating beacons associated with device')
      db.devices.findOne({ registrationId: req.body.registrationId }, function(err, doc) {
        if (err) return res.error(err)
        /* 
         * An unregistered/invalid registrationId isn't great but shouldn't prevent
         * the call from proceeding 
         */
        if (!doc) return doEntities()

        doc.beacons = req.body.entityIds
        doc.beaconsDate = util.getTime()

        var options = {
          asAdmin: true,
          user: util.adminUser
        }

        db.devices.safeUpdate(doc, options, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())
          doEntities()
        })
      })
    }
  }

  function doEntities() {
    log('doEntities')
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

  var parts = { entities:[], links:[] }
  var entityIds = options.entityIds
  var activeLinks = options.activeLinks || []
  var linkSort = options.linkSort
  var linkWhere = options.linkWhere
  var entityType = options.entityType
  var subqueries = options.subqueries
  var activeLinkTypes = []
  var loadTypes = []
  var inCountTypes = []
  var outCountTypes = []
  var linkTypes = []
  var inTypes = []
  var outTypes = []
  var inActiveLinks = []
  var outActiveLinks = []

  activeLinks.forEach(function(activeLink) {
    activeLinkTypes.push(activeLink.type)
    if (activeLink.load) {
      loadTypes.push(activeLink.type)
    }
    if (activeLink.links) {
      linkTypes.push(activeLink.type)
    }
    if (activeLink.direction === 'both' || activeLink.direction === 'in') {
      inTypes.push(activeLink.type)
      inActiveLinks.push(activeLink)
      if (activeLink.count) {
        inCountTypes.push(activeLink.type)
      }
    }
    if (activeLink.direction === 'both' || activeLink.direction === 'out') {
      outTypes.push(activeLink.type)
      outActiveLinks.push(activeLink)
      if (activeLink.count) {
        outCountTypes.push(activeLink.type)
      }
    }
  })

  addEntities()

  function addEntities() {
    log('addEntities')
    var query = { _id:{ $in: entityIds }, enabled: true }
    db[entityType]
      .find(query)
      .toArray(function(err, entities) {

      if (err) return finish(err)

      if (entities.length > 0) {
        parts.entities = entities
        parts.entityIds = []
        parts.userIds = []
        parts.entities.forEach(function(entity) {
          parts.entityIds.push(entity._id)
          parts.userIds.push(entity._creator)
          parts.userIds.push(entity._modifier)
        })
        subqueries ? addLinksInLimited() : addLinksIn()
      }
      else {
        finish()
      }
    })
  }

  function addLinksIn() {
    log('addLinksIn')
    var query = { 
      _to: { $in: parts.entityIds }, 
      type: { $in: inTypes },
    }
    db.links
      .find(query)
      .toArray(function(err, links) {

      if (err) return finish(err)
      if (links.length === 0) {
        addLinksOut()
      }
      else {
        parts.linkedIds = parts.linkedIds || []
        parts.linkIds = parts.linkIds || []
        for (var i = links.length; i--;) {
          parts.links.push(links[i])
          parts.linkIds.push(links[i]._id)
          if (loadTypes.indexOf(links[i].type) > -1) {
            parts.linkedIds.push(links[i]._from)
          }
        }
        addLinkInCounts()
      }
    })
  }

  function addLinksInLimited() {
    log('addLinksInLimited')

    async.forEachSeries(parts.entityIds, processEntity, finish)        

    function processEntity(entityId, next) {

      async.forEachSeries(inActiveLinks, processLinkType, finish)        

      function processLinkType(activeLink, next) {
        var query = { _to: entityId, type: activeLink.type }
        db.links
          .find(query)
          .toArray(function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {
            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = links.length; i--;) {
              parts.links.push(links[i])
              parts.linkIds.push(links[i]._id)
              if (loadTypes.indexOf(links[i].type) > -1) {
                parts.linkedIds.push(links[i]._from)
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
      if (err) return res.error(err)
      parts.links.length > 0 ? addLinkInCounts() : addLinksOutLimited()
    }
  }  

  function addLinkInCounts() {
    log('addLinkInCounts')
    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    var query = { 
      _to: { $in: ids },
      type: { $in: inCountTypes },
    }
    req.query = { countBy: ['_to', 'type'], find: query}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.linkInCounts = results.data
      subqueries ? addLinksOutLimited() : addLinksOut()
    })
  }

  function addLinksOut() {
    log('addLinksOut')
    var query = { 
      _from:{ $in: parts.entityIds },
      type: { $in: outTypes },
    }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length === 0) {
        addLinkStats()
      }
      else {
        parts.linkedIds = parts.linkedIds || []
        parts.linkIds = parts.linkIds || []
        for (var i = links.length; i--;) {
          parts.links.push(links[i])
          parts.linkIds.push(links[i]._id)
          if (loadTypes.indexOf(links[i].type) > -1) {
            parts.linkedIds.push(links[i]._to)
          }
        }
        addLinkOutCounts()
      }
    })
  }

  function addLinksOutLimited() {
    log('addLinksOutLimited')

    async.forEachSeries(parts.entityIds, processEntity, finish)        

    function processEntity(entityId, next) {

      async.forEachSeries(outActiveLinks, processLinkType, finish)        

      function processLinkType(activeLink, next) {
        var query = { _from: entityId, type: activeLink.type }
        db.links
          .find(query)
          .toArray(function(err, links) {

          if (err) return next(err)

          if (links.length !== 0) {
            parts.linkedIds = parts.linkedIds || []
            parts.linkIds = parts.linkIds || []
            for (var i = links.length; i--;) {
              parts.links.push(links[i])
              parts.linkIds.push(links[i]._id)
              if (loadTypes.indexOf(links[i].type) > -1) {
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
      if (err) return res.error(err)
      parts.links.length > 0 ? addLinkOutCounts() : addLinkStats()
    }
  }  

  function addLinkOutCounts() {
    log('addLinkOutCounts')
    req.collection = db.links
    var query = { 
      _from: { $in: parts.entityIds },
      type: { $in: outCountTypes },
    }
    req.query = { countBy: ['_from', 'type'], find: query}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.linkOutCounts = results.data
      addLinkStats()
    })
  }

  function addLinkStats() {
    log('addLinkStats')
    if (!parts.linkIds) {
      addEntityUsers()
    }
    else {
      req.collection = db.actions
      req.query = {countBy:'_target', find:{ _target:{ $in:parts.linkIds } }}
      req.method = 'get'  /* To make sure this query works anonymously */

      data.find(req, function(err, results) {
        if (err) return finish(err)
        parts.stats = results.data
        addLinkedEntities()  
      })
    }
  }

  function addLinkedEntities() {
    log('addLinkedEntities')
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit 
     * the number of child entities that get returned to the caller.
     */
    var query = { _id:{ $in:parts.linkedIds }, enabled: true }
    if (linkWhere) {
      query = { $and: [query, linkWhere] }
    }
    db['entities']
      .find(query)
      .sort(linkSort)
      .toArray(function(err, entities) {

      if (err) return finish(err)
      /* 
       * This map includes all linked entities which later is used to 
       * assign each to appropriate parent.
       */
      parts.linkedEntities = {}
      entities.forEach(function(linkedEntity) {
        parts.linkedEntities[linkedEntity._id] = linkedEntity
        parts.userIds.push(linkedEntity._creator)
        parts.userIds.push(linkedEntity._modifier)
      })
      addLinkedUsers()
    })
  }

  function addLinkedUsers() {
    log('addLinkedUsers')

    var query = { _id:{ $in:parts.linkedIds }, enabled:true }
    if (linkWhere) {
      query = { $and: [query, linkWhere] }
    }
    db.users
      .find(query)
      .toArray(function(err, linkedUsers) {
      if (err) return finish(err)
      /* 
       * This map includes all linked users which later is used to 
       * assign each to appropriate parent.
       */
      parts.linkedUsers = {}
      linkedUsers.forEach(function(linkedUser) {
        parts.linkedUsers[linkedUser._id] = linkedUser
      })
      addEntityUsers()
    })    
  }

  function addEntityUsers() {
    log('addEntityUsers')
    db.users
      .find({ _id: { $in: parts.userIds }, enabled: true})
      .toArray(function(err, users) {
      if (err) return finish(err)

      parts.users = {}
      users.forEach(function(user) {
        parts.users[user._id] = user
      })
      buildPayload()
    })
  }  

  function buildPayload() {

    parts.entities.forEach(function(entity) {
      log('building payload for ' + entity._id)

      var activeLinksLimited = []

      if (parts.links) {
        activeLinks.forEach(function(activeLink) {
          var links = getLimitedLinks(entity._id, activeLink)
          activeLinksLimited.push.apply(activeLinksLimited, links)
        })

        var linksIn = getLinksIn(entity._id, activeLinksLimited)
        var linksOut = getLinksOut(entity._id, activeLinksLimited)
        if (linksIn.length > 0) entity.linksIn = linksIn
        if (linksOut.length > 0) entity.linksOut = linksOut
      }

      if (parts.linkInCounts) {
        var linkInCounts = getLinkInCounts(entity._id) /* Link counts: comments, likers, applinks, posts, watchers */
        if (linkInCounts.length > 0) entity.linkInCounts = linkInCounts
      }
      if (parts.linkOutCounts) {
        var linkOutCounts = getLinkOutCounts(entity._id) /* Link counts: proximity */
        if (linkOutCounts.length > 0) entity.linkOutCounts = linkOutCounts
      }

      /* 
       * Add linked object types that have been eager loaded
       * - entities (posts, applinks, comments, beacons), 
       * - users (like, watch)
       */
      if (activeLinksLimited.length > 0) {
        getEntities(entity, activeLinksLimited)
        getUsers(entity, activeLinksLimited)
      }

      entity.creator = getEntityUser(entity._creator)
      entity.modifier = getEntityUser(entity._modifier)
    })

    /* Wrap it up */
    finish()    

    function getLimitedLinks(entityId, activeLink) {
      var links = []
      var countIn = 0
      var countOut = 0
      if (parts.links) {
        parts.links.forEach(function(link) {
          if (link.type === activeLink.type) {
            if (link._to === entityId) {
              if (countIn < activeLink.limit) {
                links.push(link)
                countIn++
              }
              if (countIn >= activeLink.limit && countOut >= activeLink.limit) return
            }
            else if (link._from === entityId) {
              if (countOut < activeLink.limit) {
                links.push(link)
                countOut++
              }
              if (countIn >= activeLink.limit && countOut >= activeLink.limit) return
            }
          }
        })
      }
      return links
    }

    function getLinksIn(entityId, limitedLinks) {
      var links = []
      limitedLinks.forEach(function(link) {
        if (link._to === entityId && linkTypes.indexOf(link.type) > -1) {
          var tinylink = { _from: link._from, type: link.type }

          /* Get link stats */
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._target == link._id) {
              link.stats = link.stats || []
              link.stats.push(parts.stats[i])
            }
          }

          links.push(tinylink)
        }
      })
      return links
    }

    function getLinksOut(entityId, limitedLinks) {
      var links = []
      limitedLinks.forEach(function(link) {
        if (link._from === entityId && linkTypes.indexOf(link.type) > -1) {
          var tinylink = { _to: link._to, type: link.type }

          /* Get link stats */
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._target == link._id) {
              link.stats = link.stats || []
              link.stats.push(parts.stats[i])
            }
          }

          links.push(tinylink)
        }
      })
      return links
    }

    function getLinkInCounts(entityId) {
      var linkCounts = []
      if (parts.linkInCounts) {
        parts.linkInCounts.forEach(function(linkCount) {
          if (linkCount._to === entityId) {
            linkCounts.push({ type: linkCount.type, count: linkCount.countBy })
          }
        })
      }
      return linkCounts
    }

    function getLinkOutCounts(entityId) {
      var linkCounts = []
      if (parts.linkOutCounts) {
        parts.linkOutCounts.forEach(function(linkCount) {
          if (linkCount._from === entityId) {
            linkCounts.push({ type: linkCount.type, count: linkCount.countBy })
          }
        })
      }
      return linkCounts
    }

    function getEntities(entity, limitedLinks) {
      var entities = []
      var entityMap = {}
      limitedLinks.forEach(function(link) {
        if (loadTypes.indexOf(link.type) > -1) {
          if (link._to === entity._id || link._from === entity._id) {
            var entityId = link._to == entity._id ? link._from : link._to
            var linkedEntity = parts.linkedEntities[entityId]
            if (linkedEntity != null && !entityMap[linkedEntity._id]) {
              linkedEntity.creator = getEntityUser(linkedEntity._creator)
              linkedEntity.modifier = getEntityUser(linkedEntity._modifier)
              entityMap[linkedEntity._id] = linkedEntity
            }
          }
        }
      })
      for (var propertyName in entityMap) {
        entities.push(entityMap[propertyName])
      }
      if (entities.length > 0) entity.entities = entities
    }

    function getUsers(entity, limitedLinks) {
      var users = []
      var userMap = {}
      limitedLinks.forEach(function(link) {
        if (loadTypes.indexOf(link.type) > -1) {
          if (link._to === entity._id || link._from === entity._id) {
            var userId = link._to == entity._id ? link._from : link._to
            var linkedUser = parts.linkedUsers[userId]
            if (linkedUser != null) {
              userMap[linkedUser._id] = linkedUser
            }
          }
        }
      })
      for (var propertyName in userMap) {
        users.push(userMap[propertyName])
      }
      if (users.length > 0) entity.users = users
    }

    function getEntityUser(userId) {
      if (parts.users) {
        var user = parts.users[userId]
        if (user != null) {
          result = {_id:user._id, photo:user.photo, location:user.area, name:user.name}
          return result
        }
      }
    }
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
