/*
 * getEntitiesForBeacons
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEnts').main,
  limit = 1000,
  moreRecords = false

exports.main = function(req, res) {
  if (!(req.body && 
    req.body.beaconBssids &&
    req.body.beaconBssids instanceof Array)) {
    return sendErr(res, new Error("request.body.beaconBssids[] is required"))
  }
  moreRecords = false
  module.req = req
  module.res = res
  getBeaconIdsFromNames(req.body.beaconBssids)
}

function getBeaconIdsFromNames(bssids) {
  var qry = mdb.models['beacons'].find().fields(['bssid']).limit(limit + 1)
    .where('bssid').in(bssids)
    .where('visibility').equals('public')
  qry.run(function(err, beacons) {
    if (err) return sendErr(module.res, err)
    if (!beacons.length) return sendErr(module.res, 404)
    if (beacons.length > limit) {
      beacons.pop()
      moreRecords = true
    }
    var beaconIds = []
    for (var i = beacons.length; i--;) {
      beaconIds[i] = beacons[i]._id
    }
    getDropsFromBeacons(beaconIds)
  })
}

function getDropsFromBeacons(beaconIds) {
  var qry = mdb.models['drops'].find().limit(limit + 1)
    .where('_beacon').in(beaconIds)
  qry.run(function(err, drops) {
    if (err) return sendErr(module.res, err)
    if (drops.length > limit) {
      drops.pop()
      moreRecords = true
    }
    var entIds = []
    for (var i = drops.length; i--;) {
      entIds[i] = drops[i]['_entity']
    }
    module.req.body = {entityIds: entIds}
    if (moreRecords) module.req.body.more = moreRecords
    return getEntities(module.req, module.res)
  })
}

