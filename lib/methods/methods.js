
/*
 * methods/methods.js -- shared routines for custom web methods
 */

var
  db = require('../main').db,
  log = require('../util').log,
  fieldFilter = true,
  limit = 1000,
  more = false,  // true if any query return more than limit records
  parts = {}, // module global for arrays of mogoose documents
  params = {}

module.exports.getEntities = function(entityIds, eagerLoad, beaconIds, fields, response) {
  params.entityIds = entityIds
  params.beaconIds = beaconIds
  params.eagerLoad = eagerLoad
  params.fields = fields
  params.res = response

  if (params.fields == null) {
    fieldFilter = false
    params.fields = {}
  }

  var query = {_id:{$in:entityIds},enabled:true}
  db.collection('entities').find(query, params.fields).limit(limit + 1).toArray(function(err, entities) {
    if (err) return params.res.sendErr(err)
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
      addChildren()
    }
    else {
      params.res.send({
        data: [],
        count: 0,
        more: false
      })
    }
  })
}

function addChildren() {
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
        db.collection('entities').find(query, params.fields).limit(limit + 1).toArray(function(err, childEntities) {
          if (err) return res.sendErr(err)
          parts.childEntities = childEntities
          parts.childEntities.forEach(function(childEntity) {
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

  function getChildren(entityId) {
    var children = []
    parts.childLinks.forEach(function(childLink) {
      if (childLink._to === entityId) {
        var childEntity = getRecById('childEntities', childLink._from)
        childEntity.creator = getUser(childEntity._creator)
        if (!fieldFilter || (fieldFilter && params.fields['commentsCount'] === true)) {
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

    if (!fieldFilter || (fieldFilter && params.fields['commentsCount'] == true)) {
      if (entity.comments) {
        entity.commentsCount = entity.comments.length
      }
      else {
        entity.commentsCount = 0
      }
    }

    if (params.eagerLoad.children) {
      entity.children = getChildren(entity._id)
      entity.childrenCount = entity.children.length
    }
    else {
      if (!fieldFilter || (fieldFilter && params.fields['childrenCount'] == true)) {
        entity.childrenCount = getChildrenCount(entity._id)
      }
    }

    if (!fieldFilter || (fieldFilter && params.fields['creator'] == true)) {
      entity.creator = getUser(entity._creator)
    }

    if (!fieldFilter || (fieldFilter && params.fields['_beacon'] == true)) {
      var beaconLink = getBeaconLink(entity._id)
      if (beaconLink !== null) {
        entity._beacon = beaconLink._to.substring(5)
      }
    }

    if (!fieldFilter || (fieldFilter && params.fields['location'] == true)) {
      entity.location = getLocation(entity._id, '0003:' + entity._beacon)
    }

    if (!params.eagerLoad.comments) {
      delete entity.comments
    }
  })

  params.res.send({
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
