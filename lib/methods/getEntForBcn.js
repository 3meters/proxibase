/*
 * getEntitiesForBeacons
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  notFound = { info: "Not found" },
  limit = 1000,
  moreRecords = false,
  userFields = ['name', 'location', 'imageUri', 'linkUri'],
  parts = {} // module global for arrays of mogoose documents 

exports.main = function(req, res) {
  if (!(req.body.data && 
    req.body.data.beaconBssids &&
    req.body.data.beaconBssids instanceof Array)) {
    return res.send({ Error: "request.body.data.beaconsBssids[] is required" }, 400)
  }
  module.req = req
  module.res = res
  getBeaconIdsFromNames(req.body.data.beaconBssids)
}

function getBeaconIdsFromNames(beacons) {
  var qry = mdb.models['beacons'].find().fields(['_id', 'name']).limit(limit + 1)
    .where('name').in(beacons)
    .where('visibility').equals('public')
  qry.run(getDropsFromBeacons)
}

function getDropsFromBeacons(err, beacons) {
  if (err) return module.res.send({ Error: err.stack||err}, 500)
  if (!beacons.length) return module.res.send(notFound, 404)
  if (beacons.length > limit) {
    beacons.pop()
    moreRecords = true
  }
  parts.beacons = beacons
  var beaconIds = []
  for (var i = beacons.length; i--;) {
    beaconIds[i] = beacons[i]._id
  }
  var qry = mdb.models['drops'].find().limit(limit + 1)
    .where('_beacon').in(beaconIds)
  qry.run(getEntitiesFromDrops)
}

function getEntitiesFromDrops(err, drops) {
  if (err) return module.res.send({ Error: err.stack||err }, 500)
  if (drops.length > limit) {
    drops.pop()
    moreRecords = true
  }
  parts.drops = drops
  var entIds = []
  for (var i = drops.length; i--;) {
    entIds[i] = drops[i]['_entity']
  }
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
  if (err) return module.res.send({ Error: err.stack||err }, 500)
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
  if (err) return module.res.send({ Error: err.stack||err }, 500)
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
  if (err) return module.res.send({ Error: err.stack||err }, 500)
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
        comment.author = {}
        if (comment._creator) {
          comment.author = comment._creator
          comment._creator = comment._creator._id
        }
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
        childEnt.author = {}
        if (childEnt._creator) {
          childEnt.author = childEnt._creator
          childEnt._creator = childEnt._creator._id
        }
        childEnt.comments = []
        childEnt.commentCount = getComments(childEnt._id).length
        childEnt.childCount = 0 // only one level for now
        children.push(childEnt)
      }
    })
    return children
  }

  ents.forEach(function(ent) {
    ent.drops = getDrops(ent._id)
    ent.dropCount = ent.drops.length
    ent.comments = []
    ent.commentCount = getComments(ent._id).length
    ent.children = getChildren(ent._id)
    ent.childCount = ent.children.length
    ent.author = {}
    if (ent._creator) {
      ent.author = ent._creator 
      ent._creator = ent._creator._id
    }
  })

  module.res.send({
    data: ents,
    count: ents.length,
    more: moreRecords
  })
}



