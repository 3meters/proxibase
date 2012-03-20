/*
 * getEntitiesForBeacons
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  limit = 1000,
  more = false,
  req,
  res

exports.main = function(request, response) {
  req = request
  res = response

  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.beaconIds && req.body.beaconIds instanceof Array)) {
    return res.sendErr(new Error("request.body.beaconIds[] is required"))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("request.body.eagerLoad must be object type"))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("request.body.userId must be string type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }

  if (!req.body.userId) {
    req.body.userId = '0000.000000.00000.000.000000'
  }

  if (!req.body.fields) {
    req.body.fields = {}
  }

  getEntityLinks()
}

function getEntityLinks() {
  var query = { toTableId:3, _to:{ $in:req.body.beaconIds }}
  db.collection('links').find(query, {_from:true}).toArray(function(err, links) {
    if (err) return res.sendErr(err)
    var entityIds = []
    for (var i = links.length; i--;) {
      entityIds.push(links[i]._from)
    }
    filterEntityList(entityIds)
  })
}

function filterEntityList(entityIds) {
  var query = {_id:{$in:entityIds}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId}]}
  db.collection('entities').find(query, {_id:true}).limit(limit + 1).toArray(function(err, entities) {

    if (err) return res.sendErr(err)
    if (entities.length == 0) {
      res.send({
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
      methods.getEntities(filteredIds, req.body.eagerLoad, req.body.beaconIds, null, res)
    }
  })
}
