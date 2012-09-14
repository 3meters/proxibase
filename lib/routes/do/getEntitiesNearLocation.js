/*
 * getEntitiesNearLocation
 */

var util = require('util')
  , db = util.db
  , log = util.log
  , methods = require('./methods')
  , options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }
  , limitMax = 1000
  , more
  , req
  , res

exports.main = function(request, response) {
  req = request
  res = response
  more = false

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

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.sendErr(new Error("options must be object type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false,parents:false}
  }

  if (!req.body.options) {
    req.body.options = options
  }

  if (!req.body.options.children) {
    req.body.options.children = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.parents) {
    req.body.options.parents = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.comments) {
    req.body.options.comments = {limit:util.statics.optionsLimitDefault, skip:0}
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.children.limit exceeded"))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.parents.limit exceeded"))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.comments.limit exceeded"))
  }

  if (!req.body.fields) {
    req.body.fields = { 
        entities: {
          _id:true, 
          _beacon:true, 
          label:true, 
          location:true, 
          imagePreviewUri:true, 
          linkUri:true 
        }, children:{},comments:{}}
  }

  doEntitiesNearLocation()
}

/*
 * Limit handling: 
 * - Beacons and links are limited using limitMax but we don't flag more or fail the method.
 * - Entities are limited using options.
 */
function doEntitiesNearLocation() {
  var query = { loc:{ $within:{ $centerSphere:[[req.body.longitude,req.body.latitude],req.body.radius] }}}
  db.collection('beacons')
    .find(query)
    .limit(limitMax)
    .toArray(function(err, beacons) {

    if (err) return res.sendErr(err)

    if (beacons.length === 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        info: 'No beacons within range',
        more: more
      })
    }
    else {
      beaconIds = []
      for (var i = beacons.length; i--;) {
        beaconIds.push(beacons[i]._id)
      }
      getEntityLinks(beaconIds)
    }
  })
}

function getEntityLinks(beaconIds) {
  var query = { toTableId:3, fromTableId:2, _to:{ $in:beaconIds }}
  db.collection('links')
    .find(query, {_from:true})
    .limit(limitMax)
    .toArray(function(err, links) {

    if (err) return res.sendErr(err)

    var entityIds = []
    for (var i = links.length; i--;) {
      entityIds.push(links[i]._from)
    }
    filterEntityList(entityIds, beaconIds)
  })
}

function filterEntityList(entityIds, beaconIds) {
  var query = {_id:{$in:entityIds}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId}]}
  db.collection('entities')
    .find(query, {_id:true})
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entities) {

    if (err) return res.sendErr(err)

    if (entities.length > req.body.options.limit) {
      entities.pop()
      more = true
    }

    if (entities.length === 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        info: "Beacons within range don\'t have any entities",
        more: more
      })
    }
    else {
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, req.body.eagerLoad, beaconIds, null, req.body.fields, req.body.options, more, res)
    }
  })
}
