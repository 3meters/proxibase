/*
 * Create dummy datafiles to load into a proxibase server
 *
 * Usage:
 *
 *    node gen
 *
 *    node gen --help
 */

var
  fs = require('fs'),
  path = require('path'),
  program = require('commander'),
  _ = require('underscore'),
  constants = require('../../test/constants.js'),
  tableMap = constants.tableMap,
  jid = constants.jid,
  gid = constants.gid,
  timeStamp = constants.timeStamp,
  log = require('../../lib/util').log

program
  .option('-b, --beacons <beacons>', 'beacons to generate [3]', Number, 3)
  .option('-e, --epb <epb>', 'entities per beacon [5]', Number, 5)
  .option('-c, --cpe <cpe>', 'child entities per entity [5]', Number, 5)
  .option('-o, --out <files>', 'output direcotry [files]', String, 'files')
  .parse(process.argv)

function run() {
  genUsers()
  genBeacons(program.beacons)
  genEntities(program.beacons * program.epb * program.cpe)
}

// just copy the defaults
function genUsers() {
  var users = tableMap.users.records
  save(users, 'users')
}

function makeBeaconId(recNum) {
  var id = pad(recNum, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableMap.beacons.tableId, 4) + ':'
  return  prefix + id
}

function genBeacons(count) {
  var beacons = []
  for (var i = 0; i < count; i++) {
    beacons.push({
      _id: makeBeaconId(i),
      ssid: 'Test Beacon ' + i,
      beaconType: 'fixed',
      latitude: tableMap.beacons.records[0].latitude,
      longitude: tableMap.beacons.records[0].longitude,
      visibility: 'public'
    })
  }
  save(beacons, 'beacons')
}

function genEntities(count) {
  var
    entities = [],
    links = [],
    newEnt = {}

  for (var i = 0; i < count; i++) {
    newEnt = _.clone(tableMap.entities.records[0]) // start with the defualt
    newEnt._id = genId('entities', i)
    newEnt.root = false
    newEnt.label = "Test Entitiy " + i
    newEnt.title = "Test Entitiy " + i

    // is entity a root
    if (i % program.cpe === 0) { // children per entity
      newEnt.root = true
      // create link to beacon
      var beaconNum = Math.floor(i / program.cpe / program.epb) // entities per beacon
      // log('beaconNum ' + beaconNum)
      links.push({
        _from: newEnt._id,
        _to: makeBeaconId(beaconNum)
      })
    }
    entities.push(newEnt)
    if (!newEnt.root) {
      // create link to parent entity
      var parentRecNum = (i - (i % program.cpe)) // children per entity, tricky
      // log('parentRecNum ' + parentRecNum)
      links.push({
        _from: newEnt._id,
        _to: genId('entities', parentRecNum)
      })
    }
  }
  save(entities, 'entities')
  save(links, 'links')
}

function save(tbl, name) {
  if (!path.existsSync(program.out)) fs.mkdirSync(program.out)
  tbl.forEach(function(row) {
    row._owner = jid
    row._creator = jid
    row._modifier =  jid
  })
  fs.writeFileSync(program.out + '/' + name + '.json', JSON.stringify(tbl))
}

function pad(number, digits) {
  var s = number.toString()
  assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s)
  for (var i = digits - s.length, zeros = ''; i--;) {
    zeros += '0'
  }
  return zeros + s
}

// put sep in string s at every freq. return delienated s
function delineate(s, freq, sep) {
  var cSeps = Math.floor(s.length / freq)
  for (var out = '', i = 0; i < cSeps; i++) {
    out += s.slice(0, freq) + sep
    s = s.slice(freq)
  }
  return out.slice(0,-1) + s // trim the last sep and add the remainder
  
}

function genId(tableName, recNum) {
  assert(tableMap[tableName], 'Invalid table name ' + tableName)
  tablePrefix = pad(tableMap[tableName].tableId, 4)
  recNum = pad(recNum, 6)
  return tablePrefix + timeStamp + recNum
}

run()
