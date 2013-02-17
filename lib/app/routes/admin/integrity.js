/**
 * routes/admin/integrity.js
 *
 * Perform integrity checks on the database
 */

var db = util.db
var config = util.config
var entityIds = []
var beaconIds = []
var report = {}                       // Map of tables to be generated

exports.findOrphans = function(req, res) {

  db.entities.find({},{_id:true}).toArray(function(err, entities) {
    if (err && res) return res.error(err)
    else if (err) throw err
    log('entity count: ' + entities.length)
    for (var i = 0; i < entities.length; i++) {
      entityIds.push(entities[i]._id)
    }
    loadBeaconIds()
  })

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
    var query = { toCollectionId:'0008', $or:[{_from:{ $nin:entityIds }}, {_to:{ $nin:beaconIds}}] }
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
    var query = { toCollectionId:'0004', $or:[{_from:{ $nin:entityIds }}, {_to:{ $nin:entityIds}}] }
    db.links.find(query, {_id:true}).toArray(function(err, links) {
      if (err && res) return res.error(err)
      else if (err) throw err
      log('orphaned links: entity to entity: ' + links.length)
      report.linksToEntities = 'orphaned links: entity to entity: ' + links.length
      for (var i = 0; i < links.length; i++) {
        log('  link: ' + links[i]._id)
      }
      done()
    })
  }

  function done() {
    res.send({report: report})
  }
}
