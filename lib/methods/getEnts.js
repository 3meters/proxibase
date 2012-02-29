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
  beaconFields = ['bssid'],
  dropFields = ['createdDate', '_creator', '_beacon', '_entity'],
  parts = {} // module global for arrays of mogoose documents 

exports.main = function(req, res) {
  if (!(req.body && 
    req.body.entityIds &&
    req.body.entityIds instanceof Array)) {
    return sendErr(res, new Error("request.body.entityIds[] is required"))
  }
  parts = {}
  moreRecords = false
  module.req = req
  module.res = res
  parts.getChildren = true
  if (typeof req.body.getChildren === 'boolean') parts.getChildren = req.body.getChildren
  if (typeof req.body.more === 'boolean') moreRecords = req.body.more
  getEntities(req.body.entityIds)
}

function getEntities(entIds) {
  parts.entIds = entIds
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('_entity').equals(null)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(function(err, ents) {
    if (err) return sendErr(module.res, err)
    if (ents.length > limit) {
      ents.pop()
      moreRecords = true
    }
    parts.ents = ents
    // TODO?  should I replace parts.entIds with IDs from parts.ents
    getChildEntitiesFromParents(entIds)
  })
}

function getChildEntitiesFromParents(entIds) {
   var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_entity').in(entIds)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(function(err, childEnts) {
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
    parts.allEntIds = parts.entIds.concat(parts.childEntIds)
    getComments(parts.allEntIds)
  })
}

function getComments(entIds) {
  var qry = mdb.models['comments'].find().limit(limit + 1)
    .where('_entity').in(entIds)
    .populate('_creator', userFields)
  qry.run(function(err, comments) {
    if (err) return sendErr(module.res, err)
    if (comments.length > limit) {
      comments.pop()
      moreRecords = true
    }
    parts.comments = comments
    getDrops(parts.entIds)
  })
}

function getDrops(entIds) {
  var qry = mdb.models['drops'].find().limit(limit + 1)
    .fields(dropFields)
    .where('_entity').in(entIds)
    .populate('_beacon', beaconFields)
  qry.run(function(err, drops) {
    if (err) return sendErr(module.res, err)
    parts.drops = drops
    buildPayload()
  })
}

function buildPayload() {
  var ents = []
  // build results
  parts.ents.forEach(function(entDoc) {
    ents.push(entDoc.serialize()) // parts are all mongoose documents, need to convert to objects
  })

  function getDrops(entId) {
    var drops = []
    parts.drops.forEach(function(drop) {
      if (drop._entity === entId) {
        drop = drop.serialize()
        // delete drop._entity
        drops.push(drop)
      }
    })
    return drops
  }

  function getComments(entId) {
    var comments = []
    parts.comments.forEach(function(comment) {
      if (comment['_entity'] === entId) {
        comment = comment.serialize()
        // delete comment._entity
        comments.push(comment)
      }
    })
    return comments
  }

  function getChildren(entId) {
    var children = []
    parts.childEnts.forEach(function(childEnt) {
      if (childEnt['_entity'] === entId) {
        childEnt = childEnt.serialize()
        populateEnt(childEnt)
        // delete childEnt._entity
        children.push(childEnt)
      }
    })
    return children
  }

  function populateEnt(ent) {
    ent.commentsCount = getComments(ent._id).length
    delete ent.name
  }

  ents.forEach(function(ent) {
    ent.entities = getChildren(ent._id)
    ent.entitiesCount = ent.entities.length
    if (!parts.getChildren) delete ent.entities
    ent.drops = getDrops(ent._id)
    ent.dropsCount = ent.drops.length
    populateEnt(ent)
  })

  module.res.send({
    data: ents,
    count: ents.length,
    more: moreRecords
  })
}



