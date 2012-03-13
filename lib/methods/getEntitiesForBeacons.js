/*
 * getEntitiesForBeacons
 */

var
  db = require('../main').db,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEntities').main,
  limit = 1000,
  more = false

exports.main = function(req, res) {
  if (!(req.body 
    && req.body.beaconIds 
    && req.body.beaconIds instanceof Array)) {
    return sendErr(res, new Error("request.body.beaconIds[] is required"))
  }
  more = false
  module.req = req
  module.res = res

  // Default userId is anonymous
  req.userId = '0000.000000.00000.000.000000'
  if (req.body && req.body.userId && typeof req.body.userId === 'string') {
    req.userId = req.body.userId
  }

  getEntityLinks(req.body.beaconIds, req.userId)
}

function getEntityLinks(beaconIds, userId) {
  var query = { toTableId:3, _to:{ $in:beaconIds }}
  db.collection('links').find(query, {_from:true}).toArray(function(err, links) {
    if (err) return sendErr(module.res, err)
    if (links.length > limit) {
      links.pop()
      more = true
    }
    var entityIds = []
    for (var i = links.length; i--;) {
      entityIds.push(links[i]._from)
    }
    filterEntityList(entityIds, userId)
  })
}

function filterEntityList(entityIds, userId) {
  var query = {_id:{$in:entityIds}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:userId}]}
  db.collection('entities').find(query, {_id:true}).limit(limit + 1).toArray(function(err, entities) {

    if (err) return sendErr(module.res, err)
    if (entities.length == 0) {
      module.res.send({
        data: [],
        count: 0,
        more: more
      })
    }
    else {
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      if (more) module.req.body.more = more
      module.req.body.entityIds = filteredIds
      return getEntities(module.req, module.res)
    }
  })
}