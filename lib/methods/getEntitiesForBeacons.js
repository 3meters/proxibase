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
  limitMax = 1000,
  more,
  req,
  res,
  beaconIdsStale,
  beaconIdsTracked,
  entityIdsStale,
  entityIdsTracked,
  linksTracked,
  count

exports.main = function(request, response) {

  /*
   * TODO: Should we limit the number of beaconIds that can be passed in.
   */
  req = request
  res = response
  more = false
  beaconIdsStale = []
  beaconIdsTracked = []
  entityIdsStale = []
  entityIdsTracked = []
  linksTracked = []

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

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.sendErr(new Error("options must be object type"))
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

  if (req.body.options.limit >= limitMax) {
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.skip >= req.body.options.limit) {
    return res.sendErr(new Error("options.skip must be less than options.limit"))
  }  

  if (req.body.beaconIds) {
    beaconIdsStale = req.body.beaconIds
    beaconIdsTracked = beaconIdsTracked.concat(req.body.beaconIds)
  }

  if (req.body.refreshIds) {
    beaconIdsTracked = beaconIdsTracked.concat(req.body.refreshIds)
  }

  getRefreshBeacons()
}

function getRefreshBeacons() {
  if (!req.body.refreshIds) {
    getEntityLinksTracked()
  }
  else {
    /* Find stale beacons */
    var query = { activityDate:{ $gt:req.body.refreshDate }, _id:{ $in:req.body.refreshIds }}
    db.collection('beacons').find(query, {_id:true}).toArray(function(err, beacons) {
      if (err) return res.sendErr(err)
      for (var i = beacons.length; i--;) {
        beaconIdsStale.push(beacons[i]._id)
      }
      getEntityLinksTracked()
    })
  }
}

/*
 * beaconIdsStale:    Only entities linked to these beacons need to be returned.
 * beaconIdsTracked:  The more flag must be based on entities for all tracked beacons.
 */

function getEntityLinksTracked() {
  /*
   * This isn't limited internally so could be a perf/security problem.
   */
  var query = { toTableId:3, _to:{ $in:beaconIdsTracked }}
  db.collection('links').find(query, {_from:true,_to:true,_id:false}).toArray(function(err, links) {
    if (err) return res.sendErr(err)
    linksTracked = links
    for (var i = links.length; i--;) {
      entityIdsTracked.push(links[i]._from)
    }
    getEntitiesTracked()
  })
}

function getEntitiesTracked() {

  var query = { _id:{ $in:entityIdsTracked}, enabled:true, $or:[{visibility:'public'}, {visibility:'private', _creator:req.body.userId }]}
  db.collection('entities')
    .find(query, { _id:true, activityDate:true })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entities) {

    if (err) return res.sendErr(err)

    /* 
     * more is based on the full set of tracked entities even though
     * some might not be returned because of optimization.
     */
    if (entities.length > req.body.options.limit) {
      entities.pop()
      more = true
    }

    /* Brutal scan to find entities that link back to stale beacons */

    for (var i = entities.length; i--;) {
      for (var j = linksTracked.length; j--;) {
        if (linksTracked[j]._from === entities[i]._id) {
          var beaconId = linksTracked[j]._to;
          for (var k = beaconIdsStale.length; k--;) {
            if (beaconIdsStale[k] === beaconId) {
              entityIdsStale.push(entities[i]._id)
            }
          }
        }
      }
    }

    if (entityIdsStale.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      /*
       * Build and return the entities that are new or stale.
       */
      methods.getEntities(entityIdsStale, req.body.eagerLoad, req.body.beaconIds, null, req.body.options, more, res)
    }
  })
}