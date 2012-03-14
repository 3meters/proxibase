/*
 * getEntitiesForBeacons
 */

var
  db = require('../main').db,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  methods = require('./methods'),
  limit = 1000,
  more = false

exports.main = function(req, res) {
  if (!req.body) {
    return sendErr(res, new Error("request.body is required"))
  }

  if (!(req.body.beaconIds && req.body.beaconIds instanceof Array)) {
    return sendErr(res, new Error("request.body.beaconIds[] is required"))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return sendErr(res, new Error("request.body.eagerLoad must be object type"))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return sendErr(res, new Error("request.body.userId must be string type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }

  if (!req.body.userId) {
    req.body.userId = '0000.000000.00000.000.000000'
  }

  module.req = req
  module.res = res

  getEntityLinks()
}

function getEntityLinks() {
  var query = { toTableId:3, _to:{ $in:module.req.body.beaconIds }}
  db.collection('links').find(query, {_from:true}).toArray(function(err, links) {
    if (err) return sendErr(module.res, err)
    var entityIds = []
    for (var i = links.length; i--;) {
      entityIds.push(links[i]._from)
    }
    filterEntityList(entityIds)
  })
}

function filterEntityList(entityIds) {
  var query = {_id:{$in:entityIds}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:module.req.body.userId}]}
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
      if (entities.length > limit) entities.pop()
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, module.req.body.eagerLoad, module.req.body.beaconIds, module.res)
    }
  })
}