
/*
 * methods/methods.js -- shared routines for custom web methods
 */

var
  db = require('../main').db,
  log = require('../util').log,
  limit = 1000,
  more = false,  // true if any query return more than limit records
  parts = {} // module global for arrays of mogoose documents

module.exports.getEntities = function(pEntityIds, pEagerLoad, pBeaconIds, pResponse) {
  entityIds = pEntityIds
  beaconIds = pBeaconIds
  eagerLoad = pEagerLoad
  res = pResponse

  var query = {_id:{$in:entityIds},enabled:true}
  db.collection('entities').find(query).limit(limit + 1).toArray(function(err, entities) {
    if (err) return res.sendErr(err)
    if (checkMore(entities)) more = true
    if (entities.length > 0) {
      parts.entities = entities
      parts.entityIds = []
      parts.childEntityIds = []
      parts.userIds = []
      parts.entities.forEach(function(entity) {
        parts.entityIds.push(entity._id)
        parts.userIds.push(entity._creator)
      })
      addChildren(parts.entityIds)
    }
    else {
      res.send({
        data: [],
        count: 0,
        more: false
      })
    }
  })
}

function addChildren(parentEntityIds) {
  var query = {toTableId:2, fromTableId:2, _to:{$in:parentEntityIds}}
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return res.sendErr(err)
    if (links.length == 0) {
      addBeaconLinks(parts.entityIds)
    }
    else {
      parts.childLinks = links
      parts.childEntityIds = []
      for (var i = links.length; i--;) {
        parts.childEntityIds.push(links[i]._from)
      }

      if (eagerLoad.children) {
        query = {_id:{$in:parts.childEntityIds},enabled:true}
        db.collection('entities').find(query).limit(limit + 1).toArray(function(err, childEntities) {
          if (err) return res.sendErr(err)
          parts.childEntities = childEntities
          parts.childEntities.forEach(function(childEntity) {
            parts.userIds.push(childEntity._creator)
          })
          addBeaconLinks(parts.entityIds)
        })
      }
      else {
        addBeaconLinks(parts.entityIds)
      }
    }
  })
}

function addBeaconLinks(parentEntityIds) {
  var query = null
  if (beaconIds) {
    query = {toTableId:3, _from:{$in:parentEntityIds}, _to:{$in:beaconIds}}
  }
  else {
    query = {toTableId:3, _from:{$in:parentEntityIds}}
  }
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return res.sendErr(err)
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
    if (err) return res.sendErr(err)
    parts.observations = observations
    addUsers()
  })
}

function addUsers() {
  db.collection('users').find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
    if (err) return res.sendErr(err)
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

  function getChildren(entityId) {
    var children = []
    parts.childLinks.forEach(function(childLink) {
      if (childLink._to === entityId) {
        var childEntity = getRecById('childEntities', childLink._from)
        childEntity.creator = getUser(childEntity._creator)
        childEntity.commentsCount = childEntity.comments.length
        if (!eagerLoad.comments) {
          delete childEntity.comments
        }
        children.push(childEntity)
      }
    })
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
    if (entity.comments) {
      entity.commentsCount = entity.comments.length
    }
    else {
      entity.commentsCount = 0
    }
    if (eagerLoad.children) {
      entity.children = getChildren(entity._id)
      entity.childrenCount = entity.children.length
    }
    else {
      entity.childrenCount = getChildrenCount(entity._id)
    }
    entity.creator = getUser(entity._creator)
    entity._beacon = getBeaconLink(entity._id)._to
    entity.location = getLocation(entity._id, entity._beacon)
    if (!eagerLoad.comments) {
      delete entity.comments
    }
  })

  res.send({
    data: parts.entities,
    count: parts.entities.length,
    more: more
  })
}

function checkMore(docs) {
  if (docs.length > limit) {
    docs.pop()
    return true
  }
  return false
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
