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
    type:    { type: 'string' },                                            // post, comment, applink
    fields:  { type: 'object', default: {} },                               // empty returns all fields
    skip:    { type: 'number', default: 0 },
    sort:    { type: 'object', default: { modifiedDate: -1 } },
    limit:   { type: 'number', default: util.statics.optionsLimitDefault,
      value: function(v) {
        if (v > util.statics.optionsLimitMax) {
          return 'Max entity limit is ' + util.statics.optionsLimitMax50
        }
        return null
      },
    },
  }

  var _body = {
    entityIds:  { type: 'array', required: true },          // array of strings
    eagerLoad:  { type: 'object', strict: false, value: {
        self:       { type: 'object', value: option.fields },
        post:       { type: 'object', value: option.fields},
        applink:    { type: 'object', value: option.fields},
        comment:    { type: 'object', value: option.fields},
      },
      default: { 
        self: { fields: {}, skip: 0, limit: util.statics.optionsLimitDefault, sort: { modifiedDate: -1 } } 
      },
    },    
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  run(req, {
    entityIds: req.body.entityIds,
    eagerLoad: req.body.eagerLoad,
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
  var eagerLoad = options.eagerLoad || {}
  var beaconIds = options.beaconIds
  var self = eagerLoad.self

  var query = { _id:{ $in:entityIds }, enabled:true }
  db.entities
    .find(query, self.fields)
    .sort(self.sort)
    .toArray(function(err, entities) {

    if (err) return finish(err)

    if (entities.length > 0) {
      parts.entities = entities
      parts.entityIds = []
      parts.userIds = []
      parts.childEntities = []
      parts.childLinks = []
      parts.childEntityIds = []
      parts.parentEntities = []
      parts.parentLinks = []
      parts.parentEntityIds = []
      parts.beacons = []
      parts.watchers = []
      parts.watchLinks = []
      parts.likeLinks = []
      parts.entities.forEach(function(entity) {
        parts.entityIds.push(entity._id)
        parts.userIds.push(entity._creator)
        parts.userIds.push(entity._modifier)
      })
      addChildren()
    }
    else {
      finish()
    }
  })

  function addChildren() {
    /*
     * This has to be redesigned if we want to support internal limiting for
     * child entities. We currently fetch all children for all entities
     * so limits can't be applied correctly for the query. We still correctly limit 
     * the number of child entities that get returned to the caller.
     */
    var query = { toCollectionId:'0004', fromCollectionId:'0004', _to:{ $in:parts.entityIds }, type:'content' }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length == 0) {
        addParents()
      }
      else {
        parts.childLinks = links
        parts.childEntityIds = []
        for (var i = links.length; i--;) {
          parts.childEntityIds.push(links[i]._from)
        }

        if (eagerLoad.children) {
          query = { _id:{ $in:parts.childEntityIds }, enabled:true }
          db.entities
            .find(query, fields.children)
            .sort(options.children.sort)
            .toArray(function(err, childEntities) {

            if (err) return finish(err)
            /* 
             * This array is all children for all entities which
             * later is scanned to assign each to appropriate parent.
             */
            parts.childEntities = childEntities
            childEntities.forEach(function(childEntity) {
              parts.userIds.push(childEntity._creator)
              parts.userIds.push(childEntity._modifier)
            })
            addParents()
          })
        }
        else {
          addParents()
        }
      }
    })
  }

  function addParents() {
    /*
     * This has to be redesigned if we want to support internal limiting for
     * parent entities. We currently fetch all parents for all entities
     * so limits can't be applied correctly for the query. We still correctly limit 
     * the number of parent entities that get returned to the caller.
     */
    var query = { toCollectionId:'0004', fromCollectionId:'0004', _from:{ $in:parts.entityIds }, type:'content' }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length == 0) {
        addProximityLinks()
      }
      else {
        parts.parentLinks = links
        parts.parentEntityIds = []
        for (var i = links.length; i--;) {
          parts.parentEntityIds.push(links[i]._to)
        }

        if (eagerLoad.parents) {
          query = { _id:{ $in:parts.parentEntityIds }, enabled:true }
          db.entities
            .find(query, fields.parents)
            .sort(options.parents.sort)
            .toArray(function(err, parentEntities) {

            if (err) return finish(err)
            /* 
             * This array is all children for all entities which
             * later is scanned to assign each to appropriate parent.
             */
            parts.parentEntities = parentEntities
            parentEntities.forEach(function(parentEntity) {
              parts.userIds.push(parentEntity._creator)
              parts.userIds.push(parentEntity._modifier)
            })
            addProximityLinks()
          })
        }
        else {
          addProximityLinks()
        }
      }
    })
  }

  function addProximityLinks() {

    var query = null
    if (beaconIds) {
      query = { toCollectionId:'0008', _from:{$in:parts.entityIds}, _to:{$in:beaconIds }, type:'proximity' }
    }
    else {
      query = { toCollectionId:'0008', _from:{$in:parts.entityIds }, type:'proximity'}
    }

    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      parts.proximityLinks = links
      parts.beaconIds = []
      parts.linkIds = []
      for (var i = links.length; i--;) {
        parts.beaconIds.push(links[i]._to)
        parts.linkIds.push(links[i]._id)
      }

      /* Get beacons for the active links */
      db.beacons.find({ _id:{$in:parts.beaconIds} }).toArray(function(err, beacons) {
        if (err) return finish(err)
        parts.beacons = beacons
        addLinkStats()
      })
    })
  }

  function addLinkStats() {

    req.collection = db.actions
    req.query = {countBy:'_target', find:{ _target:{ $in:parts.linkIds }, type:{ $in:['link_browse', 'link_proximity'] }}}
    req.method = 'get'  /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.stats = results.data
      addLikeCounts()  
    })
  }

  function addLikeCounts() {

    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.childEntityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    req.query = { countBy:'_to', find:{ '_to': { $in:ids }, type: 'like' }}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.likes = results.data
      addLiked()
    })
  }

  function addLiked() {
    if (!req.user) {
      addWatchCounts()
    }
    else {
      var ids = []
      ids.push.apply(ids, parts.entityIds)
      ids.push.apply(ids, parts.childEntityIds)

      db.links.find({ _from:req.user._id, _to:{ $in:ids }, type:'like' }).toArray(function(err, links) {
        if (err) return finish(err)
        parts.likeLinks = links
        addWatchCounts()
      })
    }
  }

  function addWatchCounts() {

    var ids = []
    ids.push.apply(ids, parts.entityIds)
    ids.push.apply(ids, parts.childEntityIds)
    ids.push.apply(ids, parts.userIds)

    req.collection = db.links
    req.query = { countBy:'_to', find:{ '_to': { $in:ids }, type: 'watch' }}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.watchers = results.data
      addWatched()
    })
  }

  function addWatched() {
    if (!req.user) {
      addUsers()
    }
    else {
      var ids = []
      ids.push.apply(ids, parts.entityIds)
      ids.push.apply(ids, parts.childEntityIds)
      ids.push.apply(ids, parts.userIds)

      db.links.find({ _from:req.user._id, _to:{ $in:ids }, type:'watch' }).toArray(function(err, links) {
        if (err) return finish(err)
        parts.watchLinks = links
        addUsers()
      })
    }
  }

  function addUsers() {
    db.users.find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
      if (err) return finish(err)
      parts.users = users
      buildPayload()
    })
  }

  function buildPayload() {

    parts.entities.forEach(function(entity) {

      log('building payload for ' + entity._id)
      if (_.isEmpty(fields.entities) || fields.entities['commentCount'] == true) {

        entity.commentsMore = false
        if (entity.comments) {
          entity.commentCount = entity.comments.length

          if (eagerLoad.comments) {
            commentsChunk = []
            for (var i = 0; i < entity.comments.length; i++) {
              if (i >= options.comments.skip + options.comments.limit) {
                entity.commentsMore = true
                break
              }
              else if (i >= options.comments.skip) {
                commentsChunk.push(entity.comments[i])
              }
            }
            entity.comments = commentsChunk
          }
        }
        else {
          entity.commentCount = 0
        }
      }

      if (_.isEmpty(fields.entities) || fields.entities['_beacon'] == true) {
        var links = getProximityLinks(entity._id)
        if (links !== null) {
          entity.links = links
        }
      }

      if (eagerLoad.children) {
        entity.children = getChildren(entity._id, entity)
      }

      if (_.isEmpty(fields.entities) || fields.entities['childCount'] == true) {
        entity.childCount = getChildCount(entity._id)
      }

      if (_.isEmpty(fields.entities) || fields.entities['likeCount'] == true) {
        entity.likeCount = getLikeCount(entity._id)
      }

      if (_.isEmpty(fields.entities) || fields.entities['watchCount'] == true) {
        entity.watchCount = getWatchCount(entity._id)
      }

      if (req.user) {
        if (_.isEmpty(fields.entities) || fields.entities['watched'] == true) {
          entity.watched = getWatched(req.user._id, entity._id)
          if (entity.watched) {
            entity.watchedDate = getWatchedDate(req.user._id, entity._id)
            entity._watcher = req.user._id
          }
        }
        if (_.isEmpty(fields.entities) || fields.entities['liked'] == true) {
          entity.liked = getLiked(req.user._id, entity._id)
        }
      }

      if (_.isEmpty(fields.entities) || fields.entities['creator'] == true) {
        entity.creator = getUser(entity._creator)
      }

      if (_.isEmpty(fields.entities) || fields.entities['modifier'] == true) {
        entity.modifier = getUser(entity._modifier)
      }

      if (!eagerLoad.comments) {
        delete entity.comments
      }
    })

    /* Wrap it up */
    finish()    

    function getProximityLinks(entityId) {
      var proximityLinks = []
      parts.proximityLinks.forEach(function(proximityLink) {
        if (proximityLink._from === entityId) {
          /* Get tuning count */
          proximityLink.tuneCount = 0
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._target == proximityLink._id) {
              proximityLink.tuneCount = parts.stats[i].countBy
              break;
            }
          }
          proximityLinks.push(proximityLink)
        }
      })
      return proximityLinks
    }

    function getUser(userId) {
      var result = null
      parts.users.forEach(function(user) {
        if (user._id === userId) {
          result = user
          return
        }
      })
      if (result != null) {
        result = {_id:result._id, photo:result.photo, location:result.location, name:result.name}
        result.watched = false 
        parts.watchLinks.forEach(function(watchLink) {
          if (watchLink._from == req.user._id && watchLink._to == result._id) {
            result.watched = true
            return
          }
        })
        result.likeCount = getLikeCount(userId)
        result.watchCount = getWatchCount(userId)

      }
      return result
    }

    function getParents(entityId, entity) {
      var parents = []
      var parentCount = 0
      entity.parentsMore = false
      for (var i = 0; i < parts.parentEntities.length; i++) {
        for (var j = 0; j < parts.parentLinks.length; j++) {
          if (parts.parentLinks[j]._to == parts.parentEntities[i]._id && parts.parentLinks[j]._from === entityId) {

            parentCount++

            if (parentCount > (options.parents.limit + options.parents.skip)) {
              entity.parentsMore = true;
              return parents
            }
            else if (parentCount > options.parents.skip) {
              var parentEntity = parts.parentEntities[i]

              if (_.isEmpty(fields.parents) || fields.parents['creator'] == true) {
                  parentEntity.creator = getUser(parentEntity._creator)
                  parentEntity.modifier = getUser(parentEntity._modifier)
              }

              if (_.isEmpty(fields.parents) || fields.parents['commentCount'] === true) {
                if (parentEntity.comments) {
                  parentEntity.commentCount = parentEntity.comments.length
                }
                else {
                  parentEntity.commentCount = 0
                }
              }
              delete parentEntity.comments
              parents.push(parentEntity)
            }
            break;
          }
        }
      }
      return parents
    }

    function getChildren(entityId, entity) {
      var children = []
      var childCount = 0
      entity.childrenMore = false
      for (var i = 0; i < parts.childEntities.length; i++) {
        for (var j = 0; j < parts.childLinks.length; j++) {
          if (parts.childLinks[j]._from == parts.childEntities[i]._id && parts.childLinks[j]._to === entityId) {

            childCount++

            if (childCount > (options.children.limit + options.children.skip)) {
              entity.childrenMore = true;
              return children
            }
            else if (childCount > options.children.skip) {
              var childEntity = parts.childEntities[i]

              if (_.isEmpty(fields.children) || fields.children['creator'] == true) {
                  childEntity.creator = getUser(childEntity._creator)
                  childEntity.modifier = getUser(childEntity._modifier)
              }

              if (_.isEmpty(fields.children) || fields.children['commentCount'] === true) {
                if (childEntity.comments) {
                  childEntity.commentCount = childEntity.comments.length
                }
                else {
                  childEntity.commentCount = 0
                }
              }
              delete childEntity.comments
              childEntity._parent = entity._id
              childEntity.likeCount = getLikeCount(childEntity._id)
              childEntity.watchCount = getWatchCount(childEntity._id)
              if (req.user) {
                childEntity.liked = getLiked(req.user._id, childEntity._id)
                childEntity.watched = getWatched(req.user._id, childEntity._id)
                if (childEntity.watched) {
                  childEntity.watchedDate = getWatchedDate(req.user._id, childEntity._id)
                  childEntity._watcher = req.user._id
                }
              }

              children.push(childEntity)
            }
            break;
          }
        }
      }
      return children
    }

    function getParentCount(entityId) {
      var parentCount = 0
      parts.parentLinks.forEach(function(parentLink) {
        if (parentLink._from === entityId) {
          parentCount++
        }
      })
      return parentCount
    }

    function getChildCount(entityId) {
      var childCount = 0
      parts.childLinks.forEach(function(childLink) {
        if (childLink._to === entityId) {
          childCount++
        }
      })
      return childCount
    }

    function getLikeCount(entityId) {
      for (var i = 0; i < parts.likes.length; i++) {
        if (parts.likes[i]._to === entityId) {
          return parts.likes[i].countBy
        }
      }
      return 0
    }

    function getLiked(userId, entityId) {
      var hit = false 
      parts.likeLinks.forEach(function(likeLink) {
        if (likeLink._from == userId && likeLink._to == entityId) {
          hit = true
          return
        }
      })
      return hit
    }

    function getWatchCount(entityId) {
      for (var i = 0; i < parts.watchers.length; i++) {
        if (parts.watchers[i]._to === entityId) {
          return parts.watchers[i].countBy
        }
      }
      return 0
    }

    function getWatched(userId, entityId) {
      var hit = false 
      parts.watchLinks.forEach(function(watchLink) {
        if (watchLink._from == userId && watchLink._to == entityId) {
          hit = true
          return
        }
      })
      return hit
    }

    function getWatchedDate(userId, entityId) {
      var date
      parts.watchLinks.forEach(function(watchLink) {
        if (watchLink._from == userId && watchLink._to == entityId) {
          date = watchLink.createdDate
          return
        }
      })
      return date
    }
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
