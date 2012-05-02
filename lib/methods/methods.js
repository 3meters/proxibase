
/*
 * methods/methods.js -- shared routines for custom web methods
 */

var
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),
  _ = require('underscore'),
  parts = {}, // module global for arrays of mogoose documents
  params = {}

/*
 * No top level limiting is done in this method. It is assumed that the caller has already 
 * identified the desired set of entities and handled any limiting. Limit reporting
 * back to the sender is done using the more parameter. 
 *
 * options.limit is still used to limit the number of child entities returned.
 */

module.exports.getEntities = function(entityIds, eagerLoad, beaconIds, fields, options, more, response) {
  params.entityIds = entityIds
  params.beaconIds = beaconIds
  params.eagerLoad = eagerLoad
  params.fields = fields
  params.options = options
  params.res = response
  params.more = more

  /* 
   * fields can be missing, empty or has settings. Using
   * an empty object causes all fields to be returned.
   */
  if (_.isEmpty(params.fields)) {
    params.fields = {entities:{},children:{},comments:{}}
  }
  else {
    if (_.isEmpty(params.fields.entities)) params.fields.entities = {}
    if (_.isEmpty(params.fields.children)) params.fields.children = {}
    if (_.isEmpty(params.fields.comments)) params.fields.comments = {}
  }

  var query = { _id:{ $in:entityIds }, enabled:true }
  db.collection('entities')
    .find(query, params.fields.entities)
    .sort(params.options.sort)
    .toArray(function(err, entities) {

    if (err) return params.res.sendErr(err)

    if (entities.length > 0) {
      parts.entities = entities
      parts.entityIds = []
      parts.childEntityIds = []
      parts.userIds = []
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
    if (err) return params.res.sendErr(err)
    if (links.length == 0) {
      parts.childLinks = []
      addBeaconLinks()
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

          if (err) return params.res.sendErr(err)
          /* 
           * This array is all children for all entities which
           * later is scanned to assign each to appropriate parent.
           */
          parts.childEntities = childEntities
          childEntities.forEach(function(childEntity) {
            parts.userIds.push(childEntity._creator)
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
    if (err) return params.res.sendErr(err)
    parts.beaconLinks = links
    parts.beaconIds = []
    for (var i = links.length; i--;) {
      parts.beaconIds.push(links[i]._to)
    }
    addLocations()
  })
}

function addLocations() {
  query = {_beacon:{$in:parts.beaconIds}, _entity:{$in:parts.entityIds}}
  db.collection('observations').find(query).toArray(function(err, observations) {
    if (err) return params.res.sendErr(err)
    parts.observations = observations
    addUsers()
  })
}

function addUsers() {
  db.collection('users').find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
    if (err) return params.res.sendErr(err)
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

            if (_.isEmpty(params.fields.children) || params.fields.children['creator'] == true) {
                childEntity.creator = getUser(childEntity._creator)
            }



            if (_.isEmpty(params.fields.children) || params.fields.children['commentsCount'] === true) {
              if (childEntity.comments) {
                childEntity.commentsCount = childEntity.comments.length
              }
              else {
                childEntity.commentsCount = 0
              }
            }



            if (!params.eagerLoad.comments) {
              delete childEntity.comments
            }
            children.push(childEntity)
          }
          break;
        }
      }
    }

    return children
  }

  function getChildrenCount(entityId) {
    var childrenCount = 0
    parts.childLinks.forEach(function(childLink) {
      if (childLink._to === entityId) {
        childrenCount++
      }
    })
    return childrenCount
  }

  function getLocation(entityId, beaconId) {
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

  parts.entities.forEach(function(entity) {

    if (_.isEmpty(params.fields.entities) || params.fields.entities['commentsCount'] == true) {
      entity.commentsMore = false
      if (entity.comments) {
        entity.commentsCount = entity.comments.length

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
        entity.commentsCount = 0
      }
    }

    if (params.eagerLoad.children) {
      entity.children = getChildren(entity._id, entity)
    }

    if (_.isEmpty(params.fields.entities) || params.fields.entities['childrenCount'] == true) {
      entity.childrenCount = getChildrenCount(entity._id)
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
      util.logErr('Find failed in propogateActivityDate')
      return
    }

    for (var i = links.length; i--;) {
      var tableName = links[i].toTableId == 2 ? 'entities' : 'beacons'
       db.collection(tableName).findOne({ _id: links[i]._to }, function (err, doc) {
        if (err) {
          util.logErr('Find failed in propogateActivityDate')
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
                util.logErr('Update failed in propogateActivityDate')
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
