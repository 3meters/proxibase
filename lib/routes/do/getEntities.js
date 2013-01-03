/*
 * routes/do/getEntities
 */
var util = require('util')
var db = util.db
var data = require('../data')  
var log = util.log
var _ = require('underscore')
var options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }

/* Public web service */
exports.main = function(req, res) {
  if (!req.body) {
    return res.error(proxErr.missingParam('body: object'))
  }

  if (!(req.body.entityIds && req.body.entityIds instanceof Array)) {
    return res.error(proxErr.missingParam('entityIds: [string]'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return res.error(proxErr.badType('entityIds[0]: string'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.error(proxErr.missingParam('eagerLoad: object'))
  }

  if (req.body.fields && typeof req.body.fields !== 'object') {
    return res.error(proxErr.missingParam('fields: object'))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.error(proxErr.missingParam('options: object'))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false,parents:false}
  }

  if (!req.body.fields) {
    req.body.fields = {}
  }

  if (!req.body.options) {
    req.body.options = options
  }

  if (!req.body.options.children) {
    req.body.options.children = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.parents) {
    req.body.options.parents = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.comments) {
    req.body.options.comments = {limit:util.statics.optionsLimitDefault, skip:0}
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.limit exceeded'))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.children.limit exceeded'))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.parents.limit exceeded'))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.comments.limit exceeded'))
  }

  run(req, {
    entityIds: req.body.entityIds,
    eagerLoad: req.body.eagerLoad,
    beaconIds: null,
    fields: req.body.fields,
    options: req.body.options
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
  var eagerLoad = options.eagerLoad
  var beaconIds = options.beaconIds
  var fields = options.fields
  var options = options.options

  /* 
   * fields can be missing, empty or has settings. Using
   * an empty object causes all fields to be returned.
   */
  if (_.isEmpty(fields)) {
    fields = {entities:{},children:{},comments:{},parents:{}}
  }
  else {
    if (_.isEmpty(fields.entities)) fields.entities = {}
    if (_.isEmpty(fields.children)) fields.children = {}
    if (_.isEmpty(fields.parents)) fields.parents = {}
    if (_.isEmpty(fields.comments)) fields.comments = {}
  }

  var query = { _id:{ $in:entityIds }, enabled:true }
  db.entities
    .find(query, fields.entities)
    .sort(options.sort)
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
      parts.entities.forEach(function(entity) {
        parts.entityIds.push(entity._id)
        parts.userIds.push(entity._creator)
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
    var query = { toCollectionId:'0004', fromCollectionId:'0004', _to:{ $in:parts.entityIds } }
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
    var query = { toCollectionId:'0004', fromCollectionId:'0004', _from:{ $in:parts.entityIds } }
    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      if (links.length == 0) {
        addLinks()
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
            })
            addLinks()
          })
        }
        else {
          addLinks()
        }
      }
    })
  }

  function addLinks() {
    var query = null
    if (beaconIds) {
      query = {toCollectionId:'0008', _from:{$in:parts.entityIds}, _to:{$in:beaconIds}}
    }
    else {
      query = {toCollectionId:'0008', _from:{$in:parts.entityIds}}
    }

    db.links.find(query).toArray(function(err, links) {
      if (err) return finish(err)
      parts.links = links
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
    req.query = {countBy:'_target', find:{ _target:{ $in:parts.linkIds }, type:{ $in:['tune_link_primary'] }}}
    req.method = 'get'  /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.stats = results.data;
      addUsers()  
    })
  }

  function addUsers() {
    db.users.find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
      if (err) return finish(err)
      parts.users = users
      buildPayload()
    })
  }

  function buildPayload() {

    function getLinks(entityId) {
      var links = []
      parts.links.forEach(function(link) {
        if (link._from === entityId) {
          /* Get tuning count */
          link.tuneCount = 0
          for (var i = 0; i < parts.stats.length; i++) {
            if (parts.stats[i]._target == link._id) {
              link.tuneCount = parts.stats[i].countBy
              break;
            }
          }
          links.push(link)
        }
      })
      return links
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
        result = {photo:result.photo, location:result.location, name:result.name}
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
        var links = getLinks(entity._id)
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

      if (_.isEmpty(fields.entities) || fields.entities['creator'] == true) {
        entity.creator = getUser(entity._creator)
      }

      if (!eagerLoad.comments) {
        delete entity.comments
      }
    })

    /* Wrap it up */
    finish()
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.entities)
  }
}
