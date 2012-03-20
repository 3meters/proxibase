/*
/*
 * getEntitiesNearLocation
 */

var
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),
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

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
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

function doEntitiesNearLocation() {
  var query = {loc: {$within:{$centerSphere:[[req.body.longitude,req.body.latitude],req.body.radius]}}}
  db.collection('beacons').find(query).limit(limit).toArray(function(err, beacons) {

    if (err) return res.sendErr(err)
    if (beacons.length === 0) {
      res.send({
        data: [],
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
  db.collection('links').find(query, {_from:true}).toArray(function(err, links) {
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
  db.collection('entities').find(query, {_id:true}).limit(limit + 1).toArray(function(err, entities) {

    if (err) return res.sendErr(err)
    if (entities.length === 0) {
      res.send({
        data: [],
        count: 0,
        info: "Beacons within range don\'t have any entities",
        more: more
      })
    }
    else {
      if (entities.length > limit) {
        entities.pop()
        more = true
      }
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, req.body.eagerLoad, beaconIds, req.body.fields, res)
    }
  })
}