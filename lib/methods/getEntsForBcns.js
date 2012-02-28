/*
 * getEntitiesForBeacons
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  limit = 1000,
  parts = {} // module global for arrays of mogoose documents 

exports.main = function(req, res) {
  if (!(req.body && 
    req.body.beaconBssids &&
    req.body.beaconBssids instanceof Array)) {
    return sendErr(res, new Error("request.body.beaconBssids[] is required"))
  }
  module.req = req
  module.res = res
  getBeaconIdsFromNames(req.body.data.beaconBssids)
}

function getBeaconIdsFromNames(beacons) {
  var qry = mdb.models['beacons'].find().fields(['_id', 'name']).limit(limit + 1)
    .where('name').in(beacons)
    .where('visibility').equals('public')
  qry.run(getDropsFromBeacons)
}

function getDropsFromBeacons(err, beacons) {
  if (err) return sendErr(module.res, err)
  if (!beacons.length) return module.res.send(notFound, 404)
  if (beacons.length > limit) {
    beacons.pop()
    moreRecords = true
  }
  parts.beacons = beacons
  var beaconIds = []
  for (var i = beacons.length; i--;) {
    beaconIds[i] = beacons[i]._id
  }
  var qry = mdb.models['drops'].find().limit(limit + 1)
    .where('_beacon').in(beaconIds)
  qry.run(getEntityIdsFromDrops)
}

function getEntityIdsFromDrops(err, drops) {
  if (err) return sendErr(module.res, err)
  if (drops.length > limit) {
    drops.pop()
    moreRecords = true
  }
  parts.drops = drops
  var entIds = []
  for (var i = drops.length; i--;) {
    entIds[i] = drops[i]['_entity']
  }
  parts.entIds = entIds
  var qry = mdb.models['entities'].find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('_parent').equals(null)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
    .populate('_creator', userFields)
  qry.run(getEntities)
}

function getEntities(err, entIds) {
  if (err) return sendErr(module.res, err)
  if (ents.length > limit) {
    ents.pop()
    moreRecords = true
  }
  module.req.body = JSON.stringify({entityIds: entIds, drops: parts.drops})
  module.req.redirect('/__do/getEntities')
}


