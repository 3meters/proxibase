/*
 * getEntities
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  limit = 1000,
  more = false,  // true if any query return more than limit records
  userFields = ['name', 'location', 'imageUri', 'linkUri'],
  linkFields = ['_from', '_to', '_creator', '_modifiedDate'],
  beaconFields = ['bssid'],
  dropFields = ['createdDate', '_creator', '_beacon', '_parent'],
  parts = {} // module global for arrays of mogoose documents 

exports.main = function(req, res) {

  if (!(req.body && 
    req.body.entityIds &&
    req.body.entityIds instanceof Array)) {
    return sendErr(res, new Error('request.body.entityIds[] is required'))
  }
  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string'))
    return sendErr(res, new Error('requested.body.entityIds[] must contain strings'))

  parts = {}
  more = false
  module.req = req
  module.res = res
  req.getChildren = true
  if (typeof req.body.getChildren === 'boolean') req.getChildren = req.body.getChildren
  if (typeof req.body.more === 'boolean') more = req.body.more
  getEntities(req.body.entityIds)
}

function getEntities(entIds) {
  parts.entIds = entIds
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(function(err, ents) {
    if (err) return sendErr(module.res, err)
    if (checkMore(ents)) more = true
    parts.ents = ents
    // reset parts.entIds based on filtered query result
    parts.entIds = []
    parts.ents.forEach(function(ent) {
      parts.entIds.push(ent['_id'])
    })
    getChildEntityLinks(parts.entIds)
  })
}

function getChildEntityLinks(entIds) {
  var qry = mdb.models['links'].find().limit(limit + 1)
    .where('_to').in(entIds)
    .where('fromTableId').equals(mdb.models['entities'].tableId)
  qry.run(function(err, childLinks) {
    if (err) return sendErr(module.res, err)
    if (checkMore(childLinks)) more = true
    parts.childLinks = childLinks
    var childEntIds = []
    childLinks.forEach(function(childLink) {
      childEntIds.push(childLink._from)
    })
    getChildEntsFromLinks(childEntIds)
  })
}

function getChildEntsFromLinks(entIds) {
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('enabled').equals(true)
    .populate('_creator', userFields)

  qry.run(function(err, childEnts) {
    if (err) return sendErr(module.res, err)
    if (checkMore(childEnts)) more = true
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
    .where('_parent').in(entIds)
    .populate('_creator', userFields)
  qry.run(function(err, comments) {
    if (err) return sendErr(module.res, err)
    if (checkMore(comments)) more = true
    parts.comments = comments
    getBeaconLinks(parts.entIds)
  })
}

function getBeaconLinks(entIds) {
  var qry = mdb.models['links'].find().limit(limit + 1)
    .where('_from').in(entIds)
    .where('toTableId').equals(mdb.models['beacons'].tableId)
  qry.run(function(err, beaconLinks) {
    if (err) return sendErr(module.res, err)
    if (checkMore(beaconLinks)) more = true
    parts.beaconLinks = beaconLinks
    buildPayload()
  })
}

function buildPayload() {
  var ents = []
  // build results
  parts.ents.forEach(function(entDoc) {
    ents.push(entDoc.serialize()) // parts are all mongoose documents, need to convert to objects
  })

  function getBeaconLinks(entId) {
    var beaconLinks = []
    parts.beaconLinks.forEach(function(beaconLink) {
      if (beaconLink._from === entId) {
        beaconLink = beaconLink.serialize()
        // delete beaconLink._from
        beaconLinks.push(beaconLink)
      }
    })
    return beaconLinks
  }

  function getComments(entId) {
    var comments = []
    parts.comments.forEach(function(comment) {
      if (comment['_parent'] === entId) {
        comment = comment.serialize()
        // delete comment._parent
        comments.push(comment)
      }
    })
    return comments
  }

  function getChildren(entId) {
    var children = []
    parts.childLinks.forEach(function(childLink) {
      if (childLink._to === entId) {
        var childEnt = getRecById(childEnts, childLink._from)
        childEnt = childEnt.serialize()
        populateEnt(childEnt)
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
    ent.children = getChildren(ent._id)
    ent.childrenCount = ent.children.length
    if (!module.req.getChildren) delete ent.children
    ent.beaconLinks = getBeaconLinks(ent._id)
    ent.beaconLinksCount = ent.beaconLinks.length
    populateEnt(ent)
  })

  module.res.send({
    data: ents,
    count: ents.length,
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

