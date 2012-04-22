/*
 * getEntitiesForBeacons
 */

var
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),    
  methods = require('./methods'),
  _ = require('underscore'),
  options = {limit:50, skip:0, sort:{modifiedDate:-1}},
  more = [],
  req,
  res,
  beaconIds = []

exports.main = function(request, response) {

  /*
   * TODO: Should we limit the number of beaconIds that can be passed in.
   */
  req = request
  res = response

  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!req.body.beaconIds && !req.body.refreshIds) {
    return res.sendErr(new Error("Either beaconIds[] or refreshIds[] is required"))
  }

  if (req.body.beaconIds && !req.body.beaconIds instanceof Array) {
    return res.sendErr(new Error("beaconIds[] must be array type"))
  }

  if (req.body.refreshIds) {
    if (!req.body.refreshIds instanceof Array) {
      return res.sendErr(new Error("refreshIds[] must be array type"))
    }
    if (!req.body.refreshDate) {
      return res.sendErr(new Error("If passing refreshIds[] then refreshDate is required"))
    }
    else if (typeof req.body.refreshDate !== 'number') {
      return res.sendErr(new Error("refreshDate must be number type"))
    }
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("eagerLoad must be object type"))
  }

  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("userId must be string type"))
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

  if (!req.body.options) {
    req.body.options = options
  }

  if (req.body.beaconIds) {
    beaconIds = req.body.beaconIds
  }
  getRefreshBeacons()
}

function getRefreshBeacons() {
  if (!req.body.refreshIds) {
    getEntityLinks()
  }
  else {
    var query = { activityDate:{ $gt:req.body.refreshDate }, _id:{ $in:req.body.refreshIds }}
    db.collection('beacons').find(query, {_id:true}).toArray(function(err, beacons) {
      if (err) return res.sendErr(err)
      for (var i = beacons.length; i--;) {
        beaconIds.push(beacons[i]._id)
      }
      getEntityLinks()
    })
  }
}

function getEntityLinks() {
  if (beaconIds.length == 0) {
    res.send({
      data: [],
      date: util.getTimeUTC(),
      count: 0,
      more: more
    })
  }
  else {
    var query = { toTableId:3, _to:{ $in:beaconIds }}
    db.collection('links').find(query, {_from:true}).toArray(function(err, links) {
      if (err) return res.sendErr(err)
      var entityIds = []
      for (var i = links.length; i--;) {
        entityIds.push(links[i]._from)
      }
      filterEntityList(entityIds)
    })
  }
}

function filterEntityList(entityIds) {
  var query = { _id:{ $in:entityIds}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId }]}
  db.collection('entities')
    .find(query, { _id:true })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entities) {

    if (err) return res.sendErr(err)
    if (entities.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, req.body.eagerLoad, req.body.beaconIds, null, req.body.options, res)
    }
  })
}