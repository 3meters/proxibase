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
  async = require('async'),
  cli = require('commander'),  // command line interface
  constants = require('../../test/constants.js'),
  goose = require('../../lib/goose'),
  tableIds = constants.tableIds,
  timeStamp = constants.timeStamp,
  getDefaultRecord = constants.getDefaultRecord,
  users = [],
  beacons = [],
  entities = [],
  links = [],
  mdb,
  log = require('../../lib/util').log

cli
  .option('-b, --beacons <num>', 'beacons to generate [3]', Number, 3)
  .option('-e, --epb <num>', 'entities per beacon [5]', Number, 5)
  .option('-c, --cpe <num>', 'child entities per entity [5]', Number, 5)
  .option('-d, --database <database>', 'database name [proxTest]', String, 'proxTest')
  .option('-f, --files', 'create files rather than update the database')
  .option('-o, --out <dir>', 'output direcotry for files [files]', String, 'files')
  .parse(process.argv)


if (cli.files) run()
else {
  // set up database connection first
  var config = require('../../conf/config') // this could get better
  config.mdb.database = cli.database
  goose.connect(config.mdb, function(err, connection) {
    if (err) throw new Error('Could not connect to database. Make sure mongod is running.')
    mdb = connection
    run()
  })
}

function run() {

  // see https://github.com/caolan/async#series
  async.series([
    genUsers(done),
    genBeacons(cli.beacons, done),
    genEntities(cli.beacons * cli.epb, true, done), // parents
    genEntities(cli.beacons * cli.epb * cli.cpe, false, done) // children
  ])

  function done(err) {
    return(err, null) // no results to post-process
  }
}

function genUsers(callback) {
  users.push(getDefaultRecord('users'))
  users.push({
    _id: genId('users', 2),
    name: 'George Snelling',
    email: 'george@3meters.com'
  })
  save(users, 'users', function(err) {
    if (err) return callback(err)
    log('saved ' + users.length + ' users')
    return callback()
  })
}

function genBeaconId(recNum) {
  var id = pad(recNum, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableIds.beacons, 4) + ':' // TODO: change to '.'
  return  prefix + id
}


function genBeacons(count, callback) {
  for (var i = 0; i < count; i++) {
    var beacon = getDefaultRecord('beacons')
    beacon._id = genBeaconId(i)
    beacon.ssid = 'Test Beacon ' + i,
    beacons.push(beacon)
  }
  save(beacons, 'beacons', function(err) {
    if (err) return callback(err)
    log('saved ' + beacons.length + ' beacons')
    return callback()
  })
}

function genEntities(count, isRoot, callback) {
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
        _to: genBeaconId(beaconNum),
        fromTableId: tableIds['entities'],
        toTableId: tableIds['beacons']
      })
    }
    else {
      // create link to parent entity
      var parentRecNum = Math.floor(i / cli.cpe) // yeah, this is right
      // log('parentRecNum ' + parentRecNum)
      links.push({
        _from: newEnt._id,
        _to: genId('entities', parentRecNum),
        fromTableId: tableIds['entities'],
        toTableId: tableIds['entities']
      })
    }
  }
  save(entities, 'entities', function(err) {
    if (err) return callback(err)
    log('saved ' + entities.length + ' entities') // + ((isRoot) ? ' parent' : ' child') + ' enities')
    save(links, 'links', function(err) {
      if (err) return callback(err)
      log('saved ' + links.length + ' links')  // + ((isRoot) ? ' beacon' : ' parent') + ' links')
      return callback()
    })
  })
}


// create a digits-length string from number left-padded with zeros
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


// make a standard _id field for a table with recNum as the last id element
function genId(tableName, recNum) {
  assert((typeof tableIds[tableName] === 'number'), 'Invalid table name ' + tableName)
  tablePrefix = pad(tableIds[tableName], 4)
  recNum = pad(recNum, 6)
  return tablePrefix + timeStamp + recNum
}


// save either to a file or to the database
function save(table, name, callback) {
  if (cli.files) {
    if (!path.existsSync(cli.out)) fs.mkdirSync(cli.out)
    fs.writeFileSync(cli.out + '/' + name + '.json', JSON.stringify(table))
    return callback()
  }
  else {
    log('saving to db NYI')
    process.exit(1)
    saveDoc(table, 0, callback)
    // 1-doc-at-a time-safe save
    function saveDoc(table, iTable, callback) {
      if (iTable >= table.length) return callback() // finished, call back
      db.collection(name).insert(table[iTable], {safe: true}, function(err, doc) {
        if (err) return callback(err)
        iTable++
        return saveDoc(table, iTable, callback) // recurse
      })
    }
  }
}
