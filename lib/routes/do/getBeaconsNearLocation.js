/*
 * getBeaconsNearLocation
 */

var util = require('util')
  , db = util.db
  , log = util.log
  , methods = require('./methods')
  , options = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  , more
  , req
  , res
  , beaconsNearLocation
  , beaconIds = []

exports.main = function(request, response) {
  req = request
  res = response
  more = false

  if (req.body.beaconIds && !req.body.beaconIds instanceof Array) {
    return res.error(proxErr.missingParam('beaconIds: array'))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.error(proxErr.missingParam('userId: string'))
  }

  if (!(req.body.latitude && typeof req.body.latitude === 'number')) {
    return res.error(proxErr.missingParam('latitude: number'))
  }

  if (!(req.body.longitude && typeof req.body.longitude === 'number')) {
    return res.error(proxErr.missingParam('longitude: number'))
  }

  if (!(req.body.radius && typeof req.body.radius === 'number')) {
    return res.error(proxErr.missingParam('radius: number'))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.error(proxErr.missingParam('options: object'))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false,parents:false}
  }

  if (!req.body.options) {
    req.body.options = options
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.limit exceeded'))
  }

  if (!req.body.fields) {
    req.body.fields = { 
        beacons: {
          _id:true, 
          bssid:true,
          visibility:true,
          label:true, 
          beaconType:true,
          latitude:true,
          longitude:true
        }}
  }

  /* Passing in beaconIds forces them to be included in the query */  
  if (req.body.beaconIds) {
    for (var i = req.body.beaconIds.length; i--;) {
      beaconIds.push(req.body.beaconIds[i])
    }
  }

  doBeaconsNearLocation()
}

/*
 * Limit handling: 
 * - Beacons are limited using options.
 * - Links used for counting entites use optionslimitMax. This limit is applied to
 *   links as a group across all the target beacons. So if a beacon has a bunch of
 *   entities, it could starve the info for other beacons. This case is caused because
 *   we query links as a group rather than for each beacon at a time.
 */
function doBeaconsNearLocation() {
  /*
  var query = { $or:[
                      {bssid:{ $in:beaconIds }}, 
                      {loc:{ $within:{ $centerSphere:[[req.body.longitude,req.body.latitude],req.body.radius] }}}
                    ], 
                $or:[
                      {visibility:'public'}, 
                      {visibility:'private', _creator:req.body.userId }
                    ]
              }

  var query = { $and:[
                {$or:[
                      {bssid:{ $in:beaconIds }}, 
                      {loc:{ $within:{ $centerSphere:[[req.body.longitude,req.body.latitude],req.body.radius] }}}
                    ]}, 
                {$or:[
                      {visibility:'public'}, 
                      {visibility:'private', _creator:req.body.userId }
                    ]}
              ]}


  */
  log(beaconIds)
  var query = { 
                loc:{ $within:{ $centerSphere:[[req.body.longitude,req.body.latitude],req.body.radius] }}, 
                $or:[
                      {visibility:'public'}, 
                      {visibility:'private', _creator:req.body.userId }
                    ]
              }

  db.beacons
    .find(query, req.body.fields.beacons)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, beacons) {

    if (err) return res.error(err)

    if (beacons.length > req.body.options.limit) {
      beacons.pop()
      more = true
    }

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
      beaconsNearLocation = beacons
      beaconIds = []
      for (var i = beaconsNearLocation.length; i--;) {
        beaconsNearLocation[i].entityCount = 0
        beaconsNearLocation[i].collectionCount = 0;
        beaconsNearLocation[i].pictureCount = 0;
        beaconsNearLocation[i].postCount = 0;
        beaconsNearLocation[i].linkCount = 0;
        beaconIds.push(beaconsNearLocation[i]._id)
      }
      getEntityCounts()
    }
  })
}

function getEntityCounts() {
  /* 
   * We include public and private entities in the counts. I don't consider
   * this a privacy issue because we never show the actual content of private entities
   * unless the current user is the owner.
   */
  var query = { toTableId:3, fromTableId:2, _to:{ $in:beaconIds }}
  db.links
    .find(query, {_from:true, _to:true})
    .limit(util.statics.optionsLimitMax)
    .toArray(function(err, links) {

    if (err) return res.error(err)

    /* Capture the entityIds */
    var entityIds = []
    for (var i = links.length; i--;) {
      entityIds.push(links[i]._from)
    }

    /* 
     * Walk the links and count them for each beacon. The count will only
     * include top level entities. Child entities are not linked to beacons
     * so they aren't included in this count.
     */
    for (var i = beaconsNearLocation.length; i--;) {
      for (var j = links.length; j--;) {
        if (beaconsNearLocation[i]._id === links[j]._to) {
          beaconsNearLocation[i].entityCount++
        }
      }
    }

    getEntityTypeCounts(entityIds, beaconIds, links)
  })
}

function getEntityTypeCounts(entityIds, beaconIds, links) {
  var query = {_id:{$in:entityIds}, enabled:true}
  db.entities
    .find(query, {_id:true, type:true})
    .limit(util.statics.optionsLimitMax)
    .toArray(function(err, entities) {

    if (err) return res.error(err)

    if (entities.length > 0) {
      for (var i = entities.length; i--;) {
        for (var j = links.length; j--;) {
          if (links[j]._from === entities[i]._id) {
            for (var k = beaconsNearLocation.length; k--;) {
              if (beaconsNearLocation[k]._id === links[j]._to) {
                if (entities[i].type === methods.statics.typeCollection) {
                  beaconsNearLocation[k].collectionCount++
                } 
                else if (entities[i].type === methods.statics.typePicture) {
                  beaconsNearLocation[k].pictureCount++
                } 
                else if (entities[i].type === methods.statics.typePost) {
                  beaconsNearLocation[k].postCount++
                } 
                else if (entities[i].type === methods.statics.typeLink) {
                  beaconsNearLocation[k].linkCount++
                } 
              }
            }
          }
        }
      }
    }
    res.send({
      data: beaconsNearLocation,
      date: util.getTimeUTC(),
      count: beaconsNearLocation.length,
      more: more
    })
  })
}
