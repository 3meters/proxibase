/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */

var util = require('util')
var db = util.db
var data = require('../data')  
var log = util.log
var sreq = util.request // service request (non-aircandi)
var _ = require('underscore')

/*
 * Statics
 */
module.exports.statics = {
  typePicture: 'com.aircandi.candi.picture',
  typePlace: 'com.aircandi.candi.place',
  typePost: 'com.aircandi.candi.post',
  typeLink: 'com.aircandi.candi.link',
  typeFolder: 'com.aircandi.candi.folder'
}

/*
 * No top level limiting is done in this method. It is assumed that the caller has already 
 * identified the desired set of entities and handled any limiting. Limit reporting
 * back to the sender is done using the more parameter. 
 *
 * options.limit is still used to limit the number of child entities returned.
 * 
 * Comments are stripped from children but we still provide the commentCount.
 */

module.exports.getEntities = function(entityIds, eagerLoad, beaconIds, fields, options, more, req, res) {
  req.state = {}
  req.parts = {}
  req.state.entityIds = entityIds
  req.state.beaconIds = beaconIds
  req.state.eagerLoad = eagerLoad
  req.state.fields = fields
  req.state.options = options
  req.state.more = more

  /* 
   * fields can be missing, empty or has settings. Using
   * an empty object causes all fields to be returned.
   */
  if (_.isEmpty(req.state.fields)) {
    req.state.fields = {entities:{},children:{},comments:{},parents:{}}
  }
  else {
    if (_.isEmpty(req.state.fields.entities)) req.state.fields.entities = {}
    if (_.isEmpty(req.state.fields.children)) req.state.fields.children = {}
    if (_.isEmpty(req.state.fields.parents)) req.state.fields.parents = {}
    if (_.isEmpty(req.state.fields.comments)) req.state.fields.comments = {}
  }

  var query = { _id:{ $in:entityIds }, enabled:true }
  db.entities
    .find(query, req.state.fields.entities)
    .sort(req.state.options.sort)
    .toArray(function(err, entities) {

    if (err) return res.error(err)

    if (entities.length > 0) {
      req.parts.entities = entities
      req.parts.entityIds = []
      req.parts.userIds = []
      req.parts.childEntities = []
      req.parts.childLinks = []
      req.parts.childEntityIds = []
      req.parts.parentEntities = []
      req.parts.parentLinks = []
      req.parts.parentEntityIds = []
      req.parts.beacons = []
      req.parts.entities.forEach(function(entity) {
        req.parts.entityIds.push(entity._id)
        req.parts.userIds.push(entity._creator)
      })
      addChildren(req, res)
    }
    else {
      res.send({
        data: [],
        date: util.getTimeUTC(),        
        count: 0,
        more: req.state.more
      })
    }
  })
}

function addChildren(req, res) {
  /*
   * This has to be redesigned if we want to support internal limiting for
   * child entities. We currently fetch all children for all entities
   * so limits can't be applied correctly for the query. We still correctly limit 
   * the number of child entities that get returned to the caller.
   */
  var query = { toCollectionId:'0004', fromCollectionId:'0004', _to:{ $in:req.parts.entityIds } }
  db.links.find(query).toArray(function(err, links) {
    if (err) return res.error(err)
    if (links.length == 0) {
      addParents(req, res)
    }
    else {
      req.parts.childLinks = links
      req.parts.childEntityIds = []
      for (var i = links.length; i--;) {
        req.parts.childEntityIds.push(links[i]._from)
      }

      if (req.state.eagerLoad.children) {
        query = { _id:{ $in:req.parts.childEntityIds }, enabled:true }
        db.entities
          .find(query, req.state.fields.children)
          .sort(req.state.options.children.sort)
          .toArray(function(err, childEntities) {

          if (err) return res.error(err)
          /* 
           * This array is all children for all entities which
           * later is scanned to assign each to appropriate parent.
           */
          req.parts.childEntities = childEntities
          childEntities.forEach(function(childEntity) {
            req.parts.userIds.push(childEntity._creator)
          })
          addParents(req, res)
        })
      }
      else {
        addParents(req, res)
      }
    }
  })
}

function addParents(req, res) {
  /*
   * This has to be redesigned if we want to support internal limiting for
   * parent entities. We currently fetch all parents for all entities
   * so limits can't be applied correctly for the query. We still correctly limit 
   * the number of parent entities that get returned to the caller.
   */
  var query = { toCollectionId:'0004', fromCollectionId:'0004', _from:{ $in:req.parts.entityIds } }
  db.links.find(query).toArray(function(err, links) {
    if (err) return res.error(err)
    if (links.length == 0) {
      addLinks(req, res)
    }
    else {
      req.parts.parentLinks = links
      req.parts.parentEntityIds = []
      for (var i = links.length; i--;) {
        req.parts.parentEntityIds.push(links[i]._to)
      }

      if (req.state.eagerLoad.parents) {
        query = { _id:{ $in:req.parts.parentEntityIds }, enabled:true }
        db.entities
          .find(query, req.state.fields.parents)
          .sort(req.state.options.parents.sort)
          .toArray(function(err, parentEntities) {

          if (err) return res.error(err)
          /* 
           * This array is all children for all entities which
           * later is scanned to assign each to appropriate parent.
           */
          req.parts.parentEntities = parentEntities
          parentEntities.forEach(function(parentEntity) {
            req.parts.userIds.push(parentEntity._creator)
          })
          addLinks(req, res)
        })
      }
      else {
        addLinks(req, res)
      }
    }
  })
}

function addLinks(req, res) {
  var query = null
  if (req.state.beaconIds) {
    query = {toCollectionId:'0008', _from:{$in:req.parts.entityIds}, _to:{$in:req.state.beaconIds}}
  }
  else {
    query = {toCollectionId:'0008', _from:{$in:req.parts.entityIds}}
  }

  db.links.find(query).toArray(function(err, links) {
    if (err) return res.error(err)
    req.parts.links = links
    req.parts.beaconIds = []
    req.parts.linkIds = []
    for (var i = links.length; i--;) {
      req.parts.beaconIds.push(links[i]._to)
      req.parts.linkIds.push(links[i]._id)
    }

    /* Get beacons for the active links */
    db.beacons.find({ _id:{$in:req.parts.beaconIds} }).toArray(function(err, beacons) {
      if (err) return res.error(err)
      req.parts.beacons = beacons
      addLinkStats(req, res)
    })
  })
}

// Commented out temporarily.
function addLinkStats(req, res) {

  req.collection = db.actions
  req.query = {countBy:'_target', find:{ _target:{ $in:req.parts.linkIds }, type:{ $in:['tune_link_primary'] }}}
  req.method = 'get'  /* To make sure this query works anonymously */

  data.find(req, function(err, results) {
    if (err) return res.error(err)
    req.parts.stats = results.data;
    addUsers(req, res)  
  })
}

function addUsers(req, res) {
  db.users.find({_id:{$in:req.parts.userIds}}).toArray(function(err, users) {
    if (err) return res.error(err)
    req.parts.users = users
    buildPayload(req, res)
  })
}

function buildPayload(req, res) {

  function getLinks(entityId, req) {
    var links = []
    req.parts.links.forEach(function(link) {
      if (link._from === entityId) {
        /* Get tuning count */
        link.tuneCount = 0
        for (var i = 0; i < req.parts.stats.length; i++) {
          if (req.parts.stats[i]._target == link._id) {
            link.tuneCount = req.parts.stats[i].countBy
            break;
          }
        }
        links.push(link)
      }
    })

    return links
  }

  function getUser(userId, req) {
    var result = null
    req.parts.users.forEach(function(user) {
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

  function getParents(entityId, entity, req) {
    var parents = []
    var parentCount = 0
    entity.parentsMore = false
    for (var i = 0; i < req.parts.parentEntities.length; i++) {
      for (var j = 0; j < req.parts.parentLinks.length; j++) {
        if (req.parts.parentLinks[j]._to == req.parts.parentEntities[i]._id && req.parts.parentLinks[j]._from === entityId) {

          parentCount++

          if (parentCount > (req.state.options.parents.limit + req.state.options.parents.skip)) {
            entity.parentsMore = true;
            return parents
          }
          else if (parentCount > req.state.options.parents.skip) {
            var parentEntity = req.parts.parentEntities[i]

            if (_.isEmpty(req.state.fields.parents) || req.state.fields.parents['creator'] == true) {
                parentEntity.creator = getUser(parentEntity._creator, req)
            }

            if (_.isEmpty(req.state.fields.parents) || req.state.fields.parents['commentCount'] === true) {
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

  function getChildren(entityId, entity, req) {
    var children = []
    var childCount = 0
    entity.childrenMore = false
    for (var i = 0; i < req.parts.childEntities.length; i++) {
      for (var j = 0; j < req.parts.childLinks.length; j++) {
        if (req.parts.childLinks[j]._from == req.parts.childEntities[i]._id && req.parts.childLinks[j]._to === entityId) {

          childCount++

          if (childCount > (req.state.options.children.limit + req.state.options.children.skip)) {
            entity.childrenMore = true;
            return children
          }
          else if (childCount > req.state.options.children.skip) {
            var childEntity = req.parts.childEntities[i]

            if (_.isEmpty(req.state.fields.children) || req.state.fields.children['creator'] == true) {
                childEntity.creator = getUser(childEntity._creator, req)
            }

            if (_.isEmpty(req.state.fields.children) || req.state.fields.children['commentCount'] === true) {
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

  function getParentCount(entityId, req) {
    var parentCount = 0
    req.parts.parentLinks.forEach(function(parentLink) {
      if (parentLink._from === entityId) {
        parentCount++
      }
    })
    return parentCount
  }

  function getChildCount(entityId, req) {
    var childCount = 0
    req.parts.childLinks.forEach(function(childLink) {
      if (childLink._to === entityId) {
        childCount++
      }
    })
    return childCount
  }

  req.parts.entities.forEach(function(entity) {

    if (_.isEmpty(req.state.fields.entities) || req.state.fields.entities['commentCount'] == true) {

      entity.commentsMore = false
      if (entity.comments) {
        entity.commentCount = entity.comments.length

        if (req.state.eagerLoad.comments) {
          commentsChunk = []
          for (var i = 0; i < entity.comments.length; i++) {
            if (i >= req.state.options.comments.skip + req.state.options.comments.limit) {
              entity.commentsMore = true
              break
            }
            else if (i >= req.state.options.comments.skip) {
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

    if (_.isEmpty(req.state.fields.entities) || req.state.fields.entities['_beacon'] == true) {
      var links = getLinks(entity._id, req)
      if (links !== null) {
        entity.links = links
      }
    }

    if (req.state.eagerLoad.children) {
      entity.children = getChildren(entity._id, entity, req)
    }

    if (_.isEmpty(req.state.fields.entities) || req.state.fields.entities['childCount'] == true) {
      entity.childCount = getChildCount(entity._id, req)
    }

    if (_.isEmpty(req.state.fields.entities) || req.state.fields.entities['creator'] == true) {
      entity.creator = getUser(entity._creator, req)
    }

    if (!req.state.eagerLoad.comments) {
      delete entity.comments
    }
  })

  res.send({
    data: req.parts.entities,
    date: util.getTimeUTC(),
    count: req.parts.entities.length,
    more: req.state.more
  })
}

function getRecById(partName, id) {
  var result = null
  parts[partName].forEach(function(rec) {
    if (rec['_id'] === id) {
      result = rec
      return // break out of forEach function
    }
  })
  return result
}

var haversine = module.exports.haversine = function(lat1, lng1, lat2, lng2) {
  var R = 6371; // radius of earth = 6371km at equator

  // calculate delta in radians for latitudes and longitudes
  var dLat = (lat2-lat1) * Math.PI / 180;
  var dLng = (lng2-lng1) * Math.PI / 180;

  // get the radians for lat1 and lat2
  var lat1rad = lat1 * Math.PI / 180;
  var lat2rad = lat2 * Math.PI / 180;

  // calculate the distance d
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLng/2) * Math.sin(dLng/2) * 
          Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d;
}

var logAction = module.exports.logAction = function logAction(target, targetSource, type, userId, data, req) {
  /*
   * Save action, returns immediately and any error is logged
   */
  var action = {
    _target: target,
    targetSource: targetSource,
    type: type,
    _user: userId,
    data: data
  }
  var options = {
    asAdmin: true,
    user: util.adminUser
  }
  db.actions.safeInsert(action, options, function (err, savedDoc) {
    if (err) util.LogErr('Error inserting action', err)
  })
}

/*
 * Handles insert and update cases. If inserting an entity, any links to beacons
 * and parent entities must already exist or we won't be able to find them.
 * Because of special requirements, delete cases are handled in the delete logic.
 */

var propogateActivityDate = module.exports.propogateActivityDate = function(entityId, activityDate) {
  /*
   * We need to traverse all links from this entity to
   * beacons or other entities and update their activityDate.
   */
  db.links.find({ _from:entityId }).toArray(function(err, links) {
    if (err) {
      util.logErr('Find failed in propogateActivityDate', err)
      return
    }

    for (var i = links.length; i--;) {
      var tableName = links[i].toCollectionId == 2 ? 'entities' : 'beacons'
       db.collection(tableName).findOne({ _id: links[i]._to }, function (err, doc) {
        if (err) {
          util.logErr('Find failed in propogateActivityDate', err)
          return
        }

        if (doc) {
          /* 
           * We don't update activityDate if last update was less than activityDateWindow 
           */
          if (!doc.activityDate || (doc.activityDate && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {
            doc.activityDate = activityDate 
            db.collection(tableName).update({_id:doc._id}, doc, {safe:true}, function(err) {
              if (err) {
                util.logErr('Update failed in propogateActivityDate', err)
                return
              }
              log('Updated activityDate for ' + tableName + ': ' + doc._id)
            })
            if (tableName == 'entities') {
              propogateActivityDate(doc._id, activityDate) // recurse
            }
          }
        }
      })
    }
  })
}
