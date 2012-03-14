/*
/*
 * getEntitiesNearLocation
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  limit = 1000,
  more = false  

exports.main = function(req, res) {
  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.sendErr(new Error("request.body.userId of type string is required"))
  }

  if (!(req.body.latitude && typeof req.body.latitude === 'number')) {
    return res.sendErr(new Error("request.body.latitude of type number is required"))
  }

  if (!(req.body.longitude && typeof req.body.longitude === 'number')) {
    return res.sendErr(new Error("request.body.longitude of type number is required"))
  }

  if (!(req.body.radius && typeof req.body.radius === 'number')) {
    return res.sendErr(new Error("request.body.radius of type number is required"))
  }

  module.req = req
  module.res = res

  doEntitiesNearLocation()
}

function doEntitiesNearLocation() {
  var query = {loc: {$within:{$center:[module.req.body.latitude,module.req.body.longitude]}}}
  db.collection('observations').find(query, {_entity:true,latitude:true,longitude:true}).limit(limit).toArray(function(err, observations) {

    if (err) return module.res.sendErr(err)
    if (entities.length == 0) {
      module.res.send({
        data: [],
        count: 0,
        more: more
      })
    }
    else {
      if (entities.length > limit) entities.pop()
      module.entityIds = []
      for (var i = entities.length; i--;) {
        entityIds.push(entities[i]._id)
      }
      addLocations()
    }
  })
}

function addLocations() {
  query = {_entity:{$in:parts.entityIds}}
  db.collection('observations').find(query).toArray(function(err, observations) {
    if (err) return module.res.sendErr(err)
  })
}
