/**
 * routes/do/getEntities
 */

var db = util.db
var data = require('../data')
var _ = require('underscore')

/* Public web service */
exports.main = function(req, res) {

  // request body template
  var option.fields = {    
    eagerLoad:  { type: 'boolean', default: false },
    limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
      value: function(v) {
        if (v > util.statics.optionsLimitMax) {
          return 'Max entity limit is ' + util.statics.optionsLimitMax50
        }
        return null
      },
    },
  }

  var _body = {
    entityIds:  { type: 'array', required: true },                  // array of strings
    sort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for eager loaded types
    activeLinks:  { type: 'object', strict: false, value: {           // only these linked types will be processed
        post:       { type: 'object', value: option.fields},
        applink:    { type: 'object', value: option.fields},
        comment:    { type: 'object', value: option.fields},
        like:       { type: 'object', value: option.fields},
        watch:      { type: 'object', value: option.fields},
        proximity:  { type: 'object', value: option.fields},
      },
    },    
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  run(req, {
    entityIds: req.body.entityIds,
    activeLinks: req.body.activeLinks,
    sort: req.body.sort,
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
  var sort = options.sort
  var activeLinkTypes = []

  for (var propertyName in activeLinks) {
    activeLinkTypes.push(propertyName)
  }

  var query = { _id:{ $in:entityIds }, disabled:false }
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
          parts.linkedInIds.push(links[i]._from)
        }
        addLinkedInEntities()
      }
    })
  }


  function addLinkedInEntities() {
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit 
     * the number of child entities that get returned to the caller.
     */
    query = { _id:{ $in:parts.linkedInIds }, disabled:false }
    db.entities
      .find(query)
      .sort(options.sort)
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
    query = { _id:{ $in:parts.linkedInIds }, disabled:false }
    db.users.find(query).toArray(function(err, linkedInUsers) {
      if (err) return finish(err)
      parts.linkedInUsers = {}
      linkedInUsers.forEach(function(linkedInUser) {
        parts.linkedInUsers[linkedInUser._id] = linkedInUser
      })
      addUsers()
    })    
  }

  function addUsers() {
    db.users.find({ _id: { $in: parts.userIds }}).toArray(function(err, users) {
      if (err) return finish(err)
      parts.users = {}
      users.forEach(function(user) {
        parts.users[user._id] = user
      })
      addLinksOut()
    })
  }  

  function addLinksOut() {
    var query = { 
      _from:{ $in: parts.entityIds },
      type: { $in: activeLinkTypes },
    }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length === 0) {
        addLinksOut()
      }
      else {
        parts.linksOut = links
        parts.linkedOutIds = []
        for (var i = links.length; i--;) {
          parts.linkedOutIds.push(links[i]._to)
        }
        addLinkedOutBeacons()
      }
    })
  }

  function addLinkedOutBeacons() {
    query = { _id:{ $in: parts.linkedOutIds }, disabled:false }
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
    req.collection = db.actions
    req.query = {countBy:'_target', find:{ _target:{ $in:parts.linkedOutBeaconIds }, type:'link_proximity' }}
    req.method = 'get'  /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.stats = results.data
      addLinkCounts()  
    })
  }

  function addLinkCounts() {
    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    req.query = { countBy:['_to', 'type'], find:{ '_to': { $in:ids }}}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.linkCounts = results.data
      buildPayload()
    })
  }

  function buildPayload() {

    parts.entities.forEach(function(entity) {
      log('building payload for ' + entity._id)

      entity.linksIn = getLinksIn(entity._id)
      entity.linksOut = getLinksOut(entity._id)

      /* Link counts: comments, likers, applinks, posts, watchers */
      entity.linkCounts = getLinkCounts(entity._id)

      /* Linked entities that have been eager loaded: posts, applinks, comments, etc. */
      entity.entitiesIn = []
      entity.usersIn = []
      parts.linksIn.forEach(function(linkIn) {
        if (linkIn._to === entity._id) {
          var linkedEntity = parts.linkedEntities[linkIn._from]
          if (linkedEntity != null) {
            entity.entitiesIn.push(linkedEntity)
          }
          else {
            var linkedUser = parts.linkedUsers[linkIn._from]
            if (linkedUser != null) {
              entity.usersIn.push(linkedUser)
            }
          }
        }
      })

      entity.creator = getUser(entity._creator)
      entity.modifier = getUser(entity._modifier)
    })

    /* Wrap it up */
    finish()    

    function getLinksOut(entityId) {
      var links = []
      parts.linksOut.forEach(function(linkOut) {
        if (linkOut._from === entityId) {

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
          links.push(linkOut)
        }
      })
      return links
    }

    function getLinksIn(entityId) {
      var links = []
      parts.linksIn.forEach(function(linkIn) {
        if (linkIn._to === entityId) {
          links.push(linkIn)
        }
      })
      return links
    }

    function getLinkCounts(entityId) {
      var linkCounts = []
      parts.linkCounts.forEach(function(linkCount) {
        if (linkCount._to === entity._id) {
          linkCounts.push({ type: linkCount.type, count: linkCount.countBy }
        }
      }
      return linkCounts
    }

    function getUser(userId) {
      var user = parts.users[userId]
      if (user != null) {
        result = {_id:user._id, photo:user.photo, location:user.area, name:user.name}
        result.watched = false 

        parts.userLinks.forEach(function(userLink) {
          if (userLink._from == req.user._id && userLink._to == user._id && userLink.type) {
            result.watched = true
            return
          }
        })
        result.likeCount = getLikeCount(userId)
        result.watchCount = getWatchCount(userId)

      }
      return result
    }
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
