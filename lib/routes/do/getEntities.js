/**
 * routes/do/getEntities
 */

var db = util.db
var data = require('../data')

/* Public web service */
exports.main = function(req, res) {

  /* Request body template start ========================================= */
  var activeLink = {
    fields = {    
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      links:      { type: 'boolean', default: false },
      namespace:  { type: 'string', default: 'com.aircandi' },
      limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax50
          }
          return null
        },
      },
    }
  }
  var _body = {
    entityIds:    { type: 'array', required: true },                  // array of strings
    linkSort:     { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    linkWhere:    { type: 'object' },                                 // filter that will be applied to all linked objects    
    activeLinks:  { type: 'object', strict: false, value: {               
        post:       { type: 'object', value: activeLink.fields },
        applink:    { type: 'object', value: activeLink.fields },
        comment:    { type: 'object', value: activeLink.fields },
        like:       { type: 'object', value: activeLink.fields },
        watch:      { type: 'object', value: activeLink.fields },
        proximity:  { type: 'object', value: activeLink.fields },
      },
    },    
  }
  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  run(req, {
    entityIds: req.body.entityIds,
    activeLinks: req.body.activeLinks,
    linkSort: req.body.linkSort,
    linkWhere: req.body.linkWhere,
    beaconIds: null,
    }
    , function(err, entities) {
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
 * options.limit is still used to limit the number of child entities returned.
 * 
 * Comments are stripped from children but we still provide the commentCount.
 */
var run = exports.run = function(req, options, cb) {

  var parts = {entities:[]}
  var entityIds = options.entityIds
  var activeLinks = options.activeLinks || {}
  var beaconIds = options.beaconIds
  var linkSort = options.linkSort
  var linkWhere = options.linkWhere
  var activeLinkTypes = []
  var loadTypes = []
  var countTypes = []
  var linkTypes = []

  for (var propertyName in activeLinks) {
    activeLinkTypes.push(activeLinks[propertyName].namespace + '.' + propertyName)
    if (activeLinks[propertyName].load) {
      loadTypes.push(activeLinks[propertyName].namespace + '.' + propertyName)
    }
    if (activeLinks[propertyName].count) {
      countTypes.push(activeLinks[propertyName].namespace + '.' + propertyName)
    }
    if (activeLinks[propertyName].links) {
      linkTypes.push(activeLinks[propertyName].namespace + '.' + propertyName)
    }
  }

  var query = { _id:{ $in:entityIds }, enabled: true }
  db.entities
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
      addLinksIn()
    }
    else {
      finish()
    }
  })

  function addLinksIn() {
    log('addLinksIn')
    var query = { 
      _to: { $in: parts.entityIds }, 
      type: { $in: activeLinkTypes },
    }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length === 0) {
        addLinksOut()
      }
      else {
        parts.linksIn = links
        parts.linkedInIds = []
        for (var i = links.length; i--;) {
          if (loadTypes.indexOf(links[i].type) > -1) {
            parts.linkedInIds.push(links[i]._from)
          }
        }
        addLinkedInEntities()
      }
    })
  }

  function addLinkedInEntities() {
    log('addLinkedInEntities')
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit 
     * the number of child entities that get returned to the caller.
     */
    var query = { _id:{ $in:parts.linkedInIds }, enabled: true }
    if (where) {
      query = { $and: [query, linkWhere] }
    }
    db.entities
      .find(query)
      .sort(linkSort)
      .toArray(function(err, linkedInEntities) {

      if (err) return finish(err)
      /* 
       * This map includes all linked entities which later is used to 
       * assign each to appropriate parent.
       */
      parts.linkedInEntities = {}
      linkedInEntities.forEach(function(linkedInEntity) {
        parts.linkedInEntities[linkedInEntity._id] = linkedInEntity
        parts.userIds.push(linkedInEntity._creator)
        parts.userIds.push(linkedInEntity._modifier)
      })
      addLinkedInUsers()
    })
  }

  function addLinkedInUsers() {
    log('addLinkedInUsers')
    var query = { _id:{ $in:parts.linkedInIds }, enabled:true }
    if (where) {
      query = { $and: [query, linkWhere] }
    }
    db.users.find(query).toArray(function(err, linkedInUsers) {
      if (err) return finish(err)
      parts.linkedInUsers = {}
      linkedInUsers.forEach(function(linkedInUser) {
        parts.linkedInUsers[linkedInUser._id] = linkedInUser
      })
      addLinkInCounts()
    })    
  }

  function addLinkInCounts() {
    log('addLinkInCounts')
    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    var query = { 
      _to: { $in: ids },
      type: { $in: countTypes },
    }
    req.query = { countBy: ['_to', 'type'], find: query}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.linkInCounts = results.data
      addLinksOut()
    })
  }

  function addLinksOut() {
    log('addLinksOut')
    var query = { 
      _from:{ $in: parts.entityIds },
      type: { $in: activeLinkTypes },
    }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length === 0) {
        addUsers()
      }
      else {
        parts.linksOut = links
        parts.linkedOutIds = []
        for (var i = links.length; i--;) {
          if (loadTypes.indexOf(links[i].type) > -1) {
            parts.linkedOutIds.push(links[i]._to)
          }
        }
        addLinkedOutBeacons()
      }
    })
  }

  function addLinkedOutBeacons() {
    log('addLinkedOutBeacons')
    var query = { _id:{ $in: parts.linkedOutIds }, enabled:true }
    if (where) {
      query = { $and: [query, linkWhere] }
    }
    db.beacons.find(query).toArray(function(err, linkedOutBeacons) {
      if (err) return finish(err)
      parts.linkedOutBeacons = {}
      parts.linkedOutBeaconIds = []
      linkedOutBeacons.forEach(function(linkedOutBeacon) {
        parts.linkedOutBeacons[linkedOutBeacon._id] = linkedOutBeacon
        parts.linkedOutBeaconIds.push(linkedOutBeacon._id)
      })
      addBeaconLinkStats()
    })
  }

  function addBeaconLinkStats() {
    log('addBeaconLinkStats')
    req.collection = db.actions
    req.query = {countBy:'_target', find:{ _target:{ $in:parts.linkedOutBeaconIds }, type:'link_proximity' }}
    req.method = 'get'  /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.stats = results.data
      addLinkOutCounts()  
    })
  }

  function addLinkOutCounts() {
    log('addLinkOutCounts')
    req.collection = db.links
    var query = { 
      _from: { $in: parts.entityIds },
      type: { $in: countTypes },
    }
    req.query = { countBy: ['_from', 'type'], find: query}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.linkOutCounts = results.data
      addUsers()
    })
  }

  function addUsers() {
    log('addUsers')
    db.users.find({ _id: { $in: parts.userIds }, enabled: true}).toArray(function(err, users) {
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

      if (parts.linksIn) entity.linksIn = getLinksIn(entity._id)
      if (parts.linksOut) entity.linksOut = getLinksOut(entity._id)
      if (parts.linkInCounts) entity.linkInCounts = getLinkInCounts(entity._id) /* Link counts: comments, likers, applinks, posts, watchers */
      if (parts.linkOutCounts) entity.linkOutCounts = getLinkOutCounts(entity._id) /* Link counts: proximity */

      /* 
       * Add linked object types that have been eager loaded
       * - entities (posts, applinks, comments), users, beacons etc. 
       */
      getEntitiesIn(entity)
      getUsersIn(entity)
      getBeaconsOut(entity)

      entity.creator = getUser(entity._creator)
      entity.modifier = getUser(entity._modifier)
    })

    /* Wrap it up */
    finish()    

    function getLinksOut(entityId) {
      var links = []
      if (parts.linksOut) {
        parts.linksOut.forEach(function(linkOut) {
          if (linkOut._from === entityId && linkTypes.indexOf(linkOut.type) > -1) {

            /* Get tuning count */
            if (linkOut.type === 'proximity') {
              linkOut.tuneCount = 0
              for (var i = 0; i < parts.stats.length; i++) {
                if (parts.stats[i]._target == linkOut._id) {
                  linkOut.tuneCount = parts.stats[i].countBy
                  break;
                }
              }
            }
            links.push({ _from: linkOut._from, type: linkOut.type })
          }
        })
      }
      return links
    }

    function getLinksIn(entityId) {
      var links = []
        if (parts.linksIn) {
        parts.linksIn.forEach(function(linkIn) {
          if (linkIn._to === entityId && linkTypes.indexOf(linkIn.type) > -1) {
            links.push({ _from: linkIn._from, type: linkIn.type })
          }
        })
      }
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

    function getEntitiesIn(entity) {
      if (parts.linksIn) {
        entity.entities = []
        parts.linksIn.forEach(function(linkIn) {
          if (linkIn._to === entity._id) {
            var linkedEntity = parts.linkedInEntities[linkIn._from]
            if (linkedEntity != null) {
              linkedEntity.creator = getUser(linkedEntity._creator)
              linkedEntity.modifier = getUser(linkedEntity._modifier)
              entity.entities.push(linkedEntity)
            }
          }
        })
      }
    }

    function getUsersIn(entity) {
      if (parts.linksIn) {
        entity.users = []
        parts.linksIn.forEach(function(linkIn) {
          if (linkIn._to === entity._id) {
            var linkedUser = parts.linkedInUsers[linkIn._from]
            if (linkedUser != null) {
              entity.users.push(linkedUser)
            }
          }
        })
      }
    }

    function getBeaconsOut(entity) {
      if (parts.linksOut) {
        entity.beacons = []
        parts.linksOut.forEach(function(linkOut) {
          if (linkOut._from === entity._id) {
            var linkedBeacon = parts.linkedOutBeacons[linkOut._to]
            if (linkedBeacon != null) {
              entity.beacons.push(linkedBeacon)
            }
          }
        })
      }
    }

    function getUser(userId) {
      if (parts.users) {
        var user = parts.users[userId]
        if (user != null) {
          result = {_id:user._id, photo:user.photo, location:user.area, name:user.name}
        }
        return result
      }
    }
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
