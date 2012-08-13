/*
 * Perform integrity checks on the database
 */

var
  mongoskin = require('mongoskin'),
  util = require('../../util'),
  log = util.log,
  entityIds = [],
  beaconIds = [],
  report = {},                         // Map of tables to be generated
  startTime,                          // Elapsed time counter
  res,
  db

module.exports.checkOrphans = function(database, response) {
  res = response
  startTime = new Date().getTime() // start program timer
  var config = require('../../conf/config')  // local server default config.js
  config.db.database = database     // override database name
  var dbUri = config.db.host + ':' + config.db.port +  '/' + config.db.database
  db = mongoskin.db(dbUri + '?auto_reconnect')
  loadEntityIds()
}

function loadEntityIds() {
  db.collection('entities').find({},{_id:true}).toArray(function(err, entities) {
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
  db.collection('beacons').find({},{_id:true}).toArray(function(err, beacons) {
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
  db.collection('links').find(query, {_id:true}).toArray(function(err, links) {
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
  db.collection('links').find(query, {_id:true}).toArray(function(err, links) {
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
  db.collection('observations').find(query, {_id:true}).toArray(function(err, observations) {
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
  var elapsedTime = ((new Date().getTime()) - startTime) / 1000
  log('Finished in ' + elapsedTime + ' seconds')
  db.close()
  if (res) 
    res.send(report)
}
