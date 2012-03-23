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
  cli = require('commander'),  // command line interface
  constants = require('../../test/constants.js'),
  jid = constants.jid,
  tableIds = constants.tableIds,
  timeStamp = constants.timeStamp,
  getDefaultRecord = constants.getDefaultRecord,
  users = [],
  beacons = [],
  entities = [],
  links = [],
  log = require('../../lib/util').log

cli
  .option('-b, --beacons <num>', 'beacons to generate [3]', Number, 3)
  .option('-e, --epb <num>', 'entities per beacon [5]', Number, 5)
  .option('-c, --cpe <num>', 'child entities per entity [5]', Number, 5)
  .option('-o, --out <dir>', 'output direcotry [files]', String, 'files')
  .parse(process.argv)


function run() {
  genUsers()
  genBeacons(cli.beacons)
  genEntities(cli.beacons * cli.epb, true) // parents
  genEntities(cli.beacons * cli.epb * cli.cpe, false) // children
}


function genUsers() {
  users.push(getDefaultRecord('users'))
  users.push({
    _id: genId('users', 2),
    name: 'George Snelling',
    email: 'george@3meters.com'
  })
  save(users, 'users')
}


function genBeaconId(recNum) {
  var id = pad(recNum, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableIds.beacons, 4) + ':' // TODO: change to '.'
  return  prefix + id
}


function genBeacons(count) {
  for (var i = 0; i < count; i++) {
    var beacon = getDefaultRecord('beacons')
    beacon._id = genBeaconId(i)
    beacon.ssid = 'Test Beacon ' + i,
    beacons.push(beacon)
  }
  save(beacons, 'beacons')
}


function genEntities(count, isRoot) {
  var
    entName = isRoot ? 'Test Root Entity ' : 'Test Child Enitiy ',
    countParents = cli.beacons * cli.epb // child Ids start after parent Ids

  for (var i = 0; i < count; i++) {
    var newEnt = getDefaultRecord('entities')
    var recNum = isRoot ? i : i + countParents
    newEnt._id = genId('entities', recNum)
    newEnt.root = isRoot
    newEnt.label = newEnt.title = entName + recNum
    entities.push(newEnt)

    if (isRoot) {
      // create link to beacon
      var beaconNum = Math.floor(i / cli.epb)
      // log('beaconNum ' + beaconNum)
      links.push({
        _from: newEnt._id,
        _to: genBeaconId(beaconNum)
      })
    }
    else {
      // create link to parent entity
      var parentRecNum = Math.floor(i / cli.cpe) // yeah, this is right
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


function save(table, name) {
  if (!path.existsSync(cli.out)) fs.mkdirSync(cli.out)
  table.forEach(function(row) {
    row._owner = jid
    row._creator = jid
    row._modifier =  jid
  })
  fs.writeFileSync(cli.out + '/' + name + '.json', JSON.stringify(table))
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
  assert((typeof tableIds[tableName] === 'number'), 'Invalid table name ' + tableName)
  tablePrefix = pad(tableIds[tableName], 4)
  recNum = pad(recNum, 6)
  return tablePrefix + timeStamp + recNum
}

run()
