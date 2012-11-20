/**
 * routes/admin/integrity.js
 *
 * Perform integrity checks on the database
 */

var util = require('util')
  , db = util.db
  , config = util.config
  , log = util.log
  , entityIds = []
  , beaconIds = []
  , req
  , res
  , next
  , report = {}                       // Map of tables to be generated

module.exports.findOrphans = function(request, response, fn) {
  req = request
  res = response
  next = fn
  loadEntityIds()
}

function loadEntityIds() {
  db.entities.find({},{_id:true}).toArray(function(err, entities) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('entity count: ' + entities.length)
    for (var i = 0; i < entities.length; i++) {
      entityIds.push(entities[i]._id)
    }
    loadBeaconIds()
  })
}

function loadBeaconIds() {
  db.beacons.find({},{_id:true}).toArray(function(err, beacons) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('beacon count: ' + beacons.length)
    for (var i = 0; i < beacons.length; i++) {
      beaconIds.push(beacons[i]._id)
    }
    checkLinksToBeacons()
  })
}

function checkLinksToBeacons() {
  /* for each link, verify that _to and _from exist */
  var query = { toTableId:3, $or:[{_from:{ $nin:entityIds }}, {_to:{ $nin:beaconIds}}] }
  db.links.find(query, {_id:true}).toArray(function(err, links) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('orphaned links: entity to beacon: ' + links.length)
    report.linksToBeacons = 'orphaned links: entity to beacon: ' + links.length
    for (var i = 0; i < links.length; i++) {
      log('  link: ' + links[i]._id)
    }
    checkLinksToEntities()
  })
}

function checkLinksToEntities() {
  /* for each link, verify that _to and _from exist */
  var query = { toTableId:2, $or:[{_from:{ $nin:entityIds }}, {_to:{ $nin:entityIds}}] }
  db.links.find(query, {_id:true}).toArray(function(err, links) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('orphaned links: entity to entity: ' + links.length)
    report.linksToEntities = 'orphaned links: entity to entity: ' + links.length
    for (var i = 0; i < links.length; i++) {
      log('  link: ' + links[i]._id)
    }
    checkObservations()
  })
}

function checkObservations() {
  var query = { $or:[ { _entity:{ $nin:entityIds }}, { _beacon:{ $nin:beaconIds}} ] } 
  db.observations.find(query, {_id:true}).toArray(function(err, observations) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('orphaned observations: ' + observations.length)
    report.observations = 'orphaned observations: ' + observations.length
    for (var i = 0; i < observations.length; i++) {
      log('  observation: ' + observations[i]._id)
    }
    done()
  })
}

function done() {
  res.send({report: report})
}
