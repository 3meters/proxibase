/*
 * getEntities
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  limit = 1000,
  moreRecords = false,
  userFields = ['name', 'location', 'imageUri', 'linkUri'],
  parts = {} // module global for arrays of mogoose documents 

exports.main = function(req, res) {
  if (!(req.body && 
    req.body.entityIds &&
    req.body.entityIds instanceof Array)) {
    return sendErr(res, new Error("request.body.entityIds[] is required"))
  }
  module.req = req
  module.res = res
  parts.getChildren = true
  if (typeof req.body.getChildren === 'boolean') parts.getChildren = req.body.getChildren
  if (req.body.drops) parts.drops = req.body.drops
  getEntities(req.body.entityIds)
}

function getEntities(entIds) {
  parts.entIds = entIds
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('_parent').equals(null)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(getChildEntitiesFromParents)
}

function getChildEntitiesFromParents(err, ents) {
  if (err) return sendErr(module.res, err)
  if (ents.length > limit) {
    ents.pop()
    moreRecords = true
  }
  parts.ents = ents
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_parent').in(parts.entIds)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(getComments)
}

function getComments(err, childEnts) {
  if (err) return sendErr(module.res, err)
  if (childEnts.length > limit) {
    childEnts.pop()
    moreRecords = true
  }
  parts.childEnts = childEnts
  parts.childEntIds = []
  childEnts.forEach(function(childEnt, i) {
    parts.childEntIds[i] = childEnt['_id']
  })
  var qry = mdb.models['comments'].find().limit(limit + 1)
    .where('_entity').in(parts.entIds.concat(parts.childEntIds))
    .populate('_creator', userFields)
  qry.run(buildPayload)
}

function buildPayload(err, comments) {
  if (err) return senderr(module.res, err)
  if (comments.length > limit) {
    comments.pop()
    moreRecords = true
  }
  parts.comments = comments

  var ents = []
  // build results
  parts.ents.forEach(function(entDoc) {
    ents.push(entDoc.toObject()) // parts are all mongoose documents, need to convert to objects
  })

  function getDrops(entId) {
    var drops = []
    parts.drops.forEach(function(drop) {
      if (drop._entity === entId) {
        drop = drop.toObject()
        parts.beacons.forEach(function(beacon) {
          if (drop._beacon === beacon._id) drop.beaconBssid = beacon.name
        })
        drops.push(drop)
      }
    })
    return drops
  }

  function getComments(entId) {
    var comments = []
    parts.comments.forEach(function(comment) {
      if (comment['_entity'] === entId) {
        comment = comment.toObject()
        comments.push(comment)
      }
    })
    return comments
  }

  function getChildren(entId) {
    var children = []
    parts.childEnts.forEach(function(childEnt) {
      if (childEnt['_parent'] === entId) {
        childEnt = childEnt.toObject()
        childEnt.comments = []
        childEnt.commentCount = getComments(childEnt._id).length
        childEnt.childCount = 0 // only one level for now
        children.push(childEnt)
      }
    })
    return children
  }

  ents.forEach(function(ent) {
    if (parts.drops) {
      ent.drops = getDrops(ent._id)
      ent.dropCount = ent.drops.length
    }
    ent.comments = []
    ent.commentCount = getComments(ent._id).length
    if (parts.getChildren) {
      ent.children = getChildren(ent._id)
      ent.childCount = ent.children.length
    }
  })

  module.res.send({
    data: ents,
    count: ents.length,
    more: moreRecords
  })
}



