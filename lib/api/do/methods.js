
/*
 * methods/methods.js -- shared routines for custom web methods
 */

var
  util = require('../../util'),
  db = util.db,
  log = util.log,
  _ = require('underscore'),
  parts = {}, // module global for arrays of mogoose documents
  params = {}

/*
 * Statics
 */
module.exports.statics = {
  typePicture: 'com.aircandi.candi.picture',
  typePost: 'com.aircandi.candi.post',
  typeLink: 'com.aircandi.candi.link',
  typeCollection: 'com.aircandi.candi.collection'
}

/*
 * No top level limiting is done in this method. It is assumed that the caller has already 
 * identified the desired set of entities and handled any limiting. Limit reporting
 * back to the sender is done using the more parameter. 
 *
 * options.limit is still used to limit the number of child entities returned.
 *
 * If observation is passed in, it is used to override stored observations.
 * 
 * Comments are stripped from children but we still provide the commentCount.
 */

module.exports.getEntities = function(entityIds, eagerLoad, beaconIds, observation, fields, options, more, response) {
  params.entityIds = entityIds
  params.beaconIds = beaconIds
  params.eagerLoad = eagerLoad
  params.observation = observation
  params.fields = fields
  params.options = options
  params.res = response
  params.more = more

  /* 
   * fields can be missing, empty or has settings. Using
   * an empty object causes all fields to be returned.
   */
  if (_.isEmpty(params.fields)) {
    params.fields = {entities:{},children:{},comments:{},parents:{}}
  }
  else {
    if (_.isEmpty(params.fields.entities)) params.fields.entities = {}
    if (_.isEmpty(params.fields.children)) params.fields.children = {}
    if (_.isEmpty(params.fields.parents)) params.fields.parents = {}
    if (_.isEmpty(params.fields.comments)) params.fields.comments = {}
  }

  var query = { _id:{ $in:entityIds }, enabled:true }
  db.collection('entities')
    .find(query, params.fields.entities)
    .sort(params.options.sort)
    .toArray(function(err, entities) {

    if (err) return params.res.error(err)

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
      parts.entities.forEach(function(entity) {
        parts.entityIds.push(entity._id)
        parts.userIds.push(entity._creator)
      })
      addChildren()
    }
    else {
      params.res.send({
        data: [],
        date: util.getTimeUTC(),        
        count: 0,
        more: params.more
      })
    }
  })
}

function addChildren() {
  /*
   * This has to be redesigned if we want to support internal limiting for
   * child entities. We currently fetch all children for all entities
   * so limits can't be applied correctly for the query. We still correctly limit 
   * the number of child entities that get returned to the caller.
   */
  var query = { toTableId:2, fromTableId:2, _to:{ $in:parts.entityIds } }
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return params.res.error(err)
    if (links.length == 0) {
      addParents()
    }
    else {
      parts.childLinks = links
      parts.childEntityIds = []
      for (var i = links.length; i--;) {
        parts.childEntityIds.push(links[i]._from)
      }

      if (params.eagerLoad.children) {
        query = { _id:{ $in:parts.childEntityIds }, enabled:true }
        db.collection('entities')
          .find(query, params.fields.children)
          .sort(params.options.children.sort)
          .toArray(function(err, childEntities) {

          if (err) return params.res.error(err)
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
  var query = { toTableId:2, fromTableId:2, _from:{ $in:parts.entityIds } }
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return params.res.error(err)
    if (links.length == 0) {
      addBeaconLinks()
    }
    else {
      parts.parentLinks = links
      parts.parentEntityIds = []
      for (var i = links.length; i--;) {
        parts.parentEntityIds.push(links[i]._to)
      }

      if (params.eagerLoad.parents) {
        query = { _id:{ $in:parts.parentEntityIds }, enabled:true }
        db.collection('entities')
          .find(query, params.fields.parents)
          .sort(params.options.parents.sort)
          .toArray(function(err, parentEntities) {

          if (err) return params.res.error(err)
          /* 
           * This array is all children for all entities which
           * later is scanned to assign each to appropriate parent.
           */
          parts.parentEntities = parentEntities
          parentEntities.forEach(function(parentEntity) {
            parts.userIds.push(parentEntity._creator)
          })
          addBeaconLinks()
        })
      }
      else {
        addBeaconLinks()
      }
    }
  })
}

function addBeaconLinks() {
  var query = null
  if (params.beaconIds) {
    query = {toTableId:3, _from:{$in:parts.entityIds}, _to:{$in:params.beaconIds}}
  }
  else {
    query = {toTableId:3, _from:{$in:parts.entityIds}}
  }
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return params.res.error(err)
    parts.beaconLinks = links
    parts.beaconIds = []
    for (var i = links.length; i--;) {
      parts.beaconIds.push(links[i]._to)
    }
    addLocations()
  })
}

function addLocations() {
  if (params.observation) {
    addUsers();
  }
  else {
    query = {_beacon:{$in:parts.beaconIds}, _entity:{$in:parts.entityIds}}
    db.collection('observations').find(query).toArray(function(err, observations) {
      if (err) return params.res.error(err)
      parts.observations = observations
      addUsers()
    })
  }
}

function addUsers() {
  db.collection('users').find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
    if (err) return params.res.error(err)
    parts.users = users
    buildPayload()
  })
}

function buildPayload() {

  function getBeaconLink(entityId) {
    var result = null
    parts.beaconLinks.forEach(function(beaconLink) {
      if (beaconLink._from === entityId) {
        result = beaconLink
        return
      }
    })
    return result
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
      result = {imageUri:result.imageUri, location:result.location, name:result.name}
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

          if (parentCount > (params.options.parents.limit + params.options.parents.skip)) {
            entity.parentsMore = true;
            return parents
          }
          else if (parentCount > params.options.parents.skip) {
            var parentEntity = parts.parentEntities[i]

            if (_.isEmpty(params.fields.parents) || params.fields.parents['creator'] == true) {
                parentEntity.creator = getUser(parentEntity._creator)
            }

            if (_.isEmpty(params.fields.parents) || params.fields.parents['commentCount'] === true) {
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

          if (childCount > (params.options.children.limit + params.options.children.skip)) {
            entity.childrenMore = true;
            return children
          }
          else if (childCount > params.options.children.skip) {
            var childEntity = parts.childEntities[i]
            childEntity._parentId = entityId

            if (_.isEmpty(params.fields.children) || params.fields.children['creator'] == true) {
                childEntity.creator = getUser(childEntity._creator)
            }

            if (_.isEmpty(params.fields.children) || params.fields.children['commentCount'] === true) {
              if (childEntity.comments) {
                childEntity.commentCount = childEntity.comments.length
              }
              else {
                childEntity.commentCount = 0
              }
            }
            delete childEntity.comments
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

  function getLocation(entityId, beaconId) {
    if (params.observation) {
      var result = {latitude:params.observation.latitude, longitude:params.observation.longitude}
      return result
    }
    else {
      var result = null
      parts.observations.forEach(function(observation) {
        if (observation._entity === entityId && observation._beacon === beaconId) {
          result = observation
          return
        }
      })
      if (result != null) {
        result = {latitude:result.latitude, longitude:result.longitude}
      }
      return result
    }
  }

  parts.entities.forEach(function(entity) {

    if (_.isEmpty(params.fields.entities) || params.fields.entities['commentCount'] == true) {
      entity.commentsMore = false
      if (entity.comments) {
        entity.commentCount = entity.comments.length

        if (params.eagerLoad.comments) {
          commentsChunk = []
          for (var i = 0; i < entity.comments.length; i++) {
            if (i >= params.options.comments.skip + params.options.comments.limit) {
              entity.commentsMore = true
              break
            }
            else if (i >= params.options.comments.skip) {
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

    if (params.eagerLoad.children) {
      entity.children = getChildren(entity._id, entity)
    }

    if (params.eagerLoad.parents) {
      entity.parents = getParents(entity._id, entity)
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['childCount'] == true) {
      entity.childCount = getChildCount(entity._id)
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['parentCount'] == true) {
      entity.parentCount = getParentCount(entity._id)
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['creator'] == true) {
      entity.creator = getUser(entity._creator)
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['_beacon'] == true) {
      var beaconLink = getBeaconLink(entity._id)
      if (beaconLink !== null) {
        entity._beacon = beaconLink._to
      }
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['location'] == true) {
      entity.location = getLocation(entity._id, entity._beacon)
    }

    if (!params.eagerLoad.comments) {
      delete entity.comments
    }
  })

  params.res.send({
    data: parts.entities,
    date: util.getTimeUTC(),
    count: parts.entities.length,
    more: params.more
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
  db.collection('links').find({ _from:entityId }).toArray(function(err, links) {
    if (err) {
      util.logErr('Find failed in propogateActivityDate', err)
      return
    }

    for (var i = links.length; i--;) {
      var tableName = links[i].toTableId == 2 ? 'entities' : 'beacons'
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
