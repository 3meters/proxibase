/*
 * getEntitiesForBeacons
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEnts').main,
  limit = 1000,
  more = false

exports.main = function(req, res) {
  if (!(req.body && 
    req.body.beaconIds &&
    req.body.beaconIds instanceof Array)) {
    return sendErr(res, new Error("request.body.beaconIds[] is required"))
  }
  more = false
  module.req = req
  module.res = res
  if (typeof req.getChildren !== 'boolean') req.getChildren = true
  getEntityLinks(req.body.beaconIds)
}

function getEntityLinks(beaconIds) {
  var qry = mdb.models['links'].find().limit(limit + 1)
    .fields('_from')
    .where('_to').in(beaconIds)
    .where('fromTableId').equals(mdb.models.entities.tableId)
  qry.run(function(err, entLinks) {
    if (err) return sendErr(module.res, err)
    if (entLinks.length > limit) {
      entLinks.pop()
      more = true
    }
    var entIds = []
    for (var i = entLinks.length; i--;) {
      entIds[i] = entLinks[i]['_from']
    }
    filterEntityList(entIds)
  })
}

function filterEntityList(entIds) {
  var qry = mdb.models.entities.find().limit(limit + 1)
    .where('_id').in(entIds)
    .where('visibility').equals('public')
    .where('enabled').equals(true)
  qry.run(function(err, filteredEntIds) {
    if (err) return sendErr(module.res, err)
    for (var i = filteredEntIds.length; i--;) {
      filteredEntIds[i] = filteredEntIds[i]._id
    }
    module.req.body.entityIds = filteredEntIds
    if (more) module.req.body.more = more
    return getEntities(module.req, module.res)
  })
}

