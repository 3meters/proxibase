/*
 * getEntities
 */

var
  mdb = require('../main').mdb,
  db = require('../main').db,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  limit = 1000,
  more = false,  // true if any query return more than limit records
  parts = {} // module global for arrays of mogoose documents

exports.main = function(req, res) {

  if (!(req.body 
    && req.body.entityIds 
    && req.body.entityIds instanceof Array)) {
    return sendErr(res, new Error('request.body.entityIds[] is required'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return sendErr(res, new Error('requested.body.entityIds[] must contain strings'))
  }

  parts = {}
  more = false
  module.req = req
  module.res = res
  req.eagerLoad = {children:false,comments:false}

  if (typeof req.body.eagerLoad === 'object') req.eagerLoad = req.body.eagerLoad
  if (typeof req.body.more === 'boolean') more = req.body.more

  getEntities(req.body.entityIds)
}

function getEntities(entityIds) {
  var query = {_id:{$in:entityIds},enabled:true}
  db.collection('entities').find(query).limit(limit + 1).toArray(function(err, entities) {
    if (err) return sendErr(module.res, err)
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
      module.res.send({
        data: [],
        count: 0,
        more: more
      })
    }
  })
}

function addChildren(parentEntityIds) {
  var query = {toTableId:2, fromTableId:2, _to:{$in:parentEntityIds}}
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return sendErr(module.res, err)
    if (links.length == 0) {
      addBeaconLinks(parts.entityIds)
    }
    else {
      parts.childLinks = links
      parts.childEntityIds = []
      for (var i = links.length; i--;) {
        parts.childEntityIds.push(links[i]._from)
      }

      if (module.req.eagerLoad.children) {
        query = {_id:{$in:parts.childEntityIds},enabled:true}
        db.collection('entities').find(query).limit(limit + 1).toArray(function(err, childEntities) {
          if (err) return sendErr(module.res, err)
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
  var query = {toTableId:mdb.models['beacons'].tableId, _from:{$in:parentEntityIds}}
  db.collection('links').find(query).toArray(function(err, links) {
    if (err) return sendErr(module.res, err)
    parts.beaconLinks = links
    addUsers()
  })
}

function addUsers() {
  db.collection('users').find({_id:{$in:parts.userIds}}).toArray(function(err, users) {
    if (err) return sendErr(module.res, err)
    parts.users = users
    buildPayload()
  })
}

function buildPayload() {

  function getBeaconLinks(entityId) {
    var beaconLinks = []
    parts.beaconLinks.forEach(function(beaconLink) {
      if (beaconLink._from === entityId) {
        beaconLinks.push(beaconLink)
      }
    })
    return beaconLinks
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
        if (!module.req.eagerLoad.comments) {
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

  parts.entities.forEach(function(entity) {
    entity.commentCount = entity.comments.length
    if (module.req.eagerLoad.children) {
      entity.children = getChildren(entity._id)
      entity.childrenCount = entity.children.length
    }
    else {
      entity.childrenCount = getChildrenCount(entity._id)
    }
    entity.creator = getUser(entity._creator)
    var beaconLinks = getBeaconLinks(entity._id)
    entity.beacons = []
    beaconLinks.forEach(function(beaconLink) {
      entity.beacons.push(beaconLink._to)
    })
    if (!module.req.eagerLoad.comments) {
      delete entity.comments
    }
  })

  module.res.send({
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