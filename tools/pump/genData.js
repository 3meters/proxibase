/*
 * Generate dummy data for a proxibase server
 *   Save to JSON files or directly to mongodb
 *   Silently overwrites existing files or tables
 */

var
  fs = require('fs'),
  path = require('path'),
  async = require('async'),
  mongoskin = require('mongoskin'),
  log = require('../../lib/util').log,
  constants = require('../../test/constants.js'),
  tableIds = constants.tableIds,
  goose = require('../../lib/goose'), // Wraps mongoose.js
  table = {},                         // Map of tables to be generated
  startTime,                          // Elapsed time counter
  db,                                 // Mongoskin connection object
  mdb,                                // Mongoose connection object
  save,                               // Save function
  options = {                         // Default options
    beacons: 3,                       // Count of beacons
    epb: 5,                           // Entites per beacon
    spe: 5,                           // Subentities (aka children) per beacon
    cpe: 5,                           // Comments per entity
    database: 'proxTest',             // Database name
    validate: false,                  // Validate database data against mongoose schema
    files: false,                     // Output to JSON files rather than to datbase
    out: 'files'                      // File output directory
  }


module.exports.generateData = function(profile) {

  startTime = new Date().getTime() // start program timer

  for (key in profile) {
    options[key] = profile[key]
  }

  if (options.files) {
    // save to files
    if (!path.existsSync(options.out)) fs.mkdirSync(options.out)
    log('Saving to files...')
    save = saveTo.file
    run()
  }

  else {
    // save to database
    var config = require('../../conf/config')  // local server default config.js
    config.mdb.database = options.database     // override database name
    var dbUri = config.mdb.host + ':' + config.mdb.port +  '/' + config.mdb.database

    if (options.validate) {
      // save via mongoose
      log('Saving to database ' + dbUri + ' with validation')
      save = saveTo.dbValidate
    }
    else {
      // save via mongoskin
      log('Saving to database ' + dbUri)
      save = saveTo.db
    }

    db = mongoskin.db(dbUri + '?auto_reconnect')
    db.dropDatabase(function(err) {
      if (err) throw err
      ensureIndices(config, function(err) {
        if (err) throw err
        run()
      })
    })
  }
}

// Ensure the database has the indexes defined by the service's models
function ensureIndices(config, callback) {
  log('Creating database and ensuring indeces')
  goose.connect(config.mdb, function(err, connection) {
    if (err) throw err
    mdb = connection
    // When the following dummy query is fired mongoose.js will connect to the db and
    // ensure that the indeces defined in prox/lib/models are defined in the database
    mdb.models.users.find({_id:-1}, function(err) {
      log('Database Ok\nSaving to database...')
      return callback(err)
    })
  })
}

function run() {
  genUsers()
  genDocuments()
  genBeacons()
  genEntities()
  genChildEntities()
  saveAll(function(err) {
    if (err) throw err
    if (!options.files) {
      db.close()
      mdb.close()
    }
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('Finished in ' + elapsedTime + ' seconds')
  })
}

function genUsers() {
  table.users = []
  table.users.push(constants.getDefaultRecord('users1'))
  table.users.push(constants.getDefaultRecord('users2'))
}

function genDocuments() {
  table.documents = []
  table.documents.push(constants.getDefaultRecord('documents'))
}

function genBeaconId(recNum) {
  var id = pad(recNum + 1, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableIds.beacons, 4) + ':' // TODO: change to '.'
  return  prefix + id
}

function genBeacons() {
  table.beacons = []
  for (var i = 0; i < options.beacons; i++) {
    var beacon = constants.getDefaultRecord('beacons')
    beacon._id = genBeaconId(i)
    beacon.ssid = beacon.ssid + ' ' + i
    beacon.bssid = beacon._id.substring(5)
    table.beacons.push(beacon)
  }
}

function genEntities() {
  genEntityRecords(options.beacons * options.epb, true)
}

function genChildEntities(callback) {
  genEntityRecords(options.beacons * options.epb * options.spe, false)
}

// Makes entity, link, and observation records for parent entities (isRoot = true)
//   or child entities (isRoot = false)
function genEntityRecords(count, isRoot) {

  table.entities = table.entities || []
  table.links = table.links || []
  table.observations = table.observations || []

  var countParents = options.beacons * options.epb // child Ids start after parent Ids

  for (var i = 0; i < count; i++) {
    var 
      newEnt = constants.getDefaultRecord('entities'),
      recNum = isRoot ? i : i + countParents,
      beaconNum = Math.floor(i / options.epb)

    newEnt._id = genId('entities', recNum)
    newEnt.root = isRoot
    newEnt.label = newEnt.title = isRoot ? newEnt.title + ' ' + recNum : newEnt.title + ' Child ' + recNum
    table.entities.push(newEnt)

    // Link
    newLink = constants.getDefaultRecord('links')
    newLink._id = genId('links', recNum)
    newLink._from = newEnt._id
    newLink.fromTableId = tableIds['entities']
    if (isRoot) {
      // Link to beacon
      newLink._to = genBeaconId(beaconNum)
      newLink.toTableId = tableIds['beacons']
    }
    else {
      // Link to parent entity
      var parentRecNum = Math.floor(i / options.cpe) // yeah, this is right
      newLink._to = genId('entities', parentRecNum)
      newLink.toTableId = tableIds['entities']
    }
    table.links.push(newLink)

    // Observation
    var newObservation = constants.getDefaultRecord('observations')
    newObservation._id = genId('observations', recNum)
    newObservation._beacon = genBeaconId(beaconNum)
    newObservation._entity = newEnt._id
    table.observations.push(newObservation)

    // Comments
    newEnt.comments = []
    for (var j = 0; j < options.cpe; j++) {
      newEnt.comments.push(constants.comments)
    }
  }
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
  recNum = pad(recNum + 1, 6)
  return tablePrefix + '.' + constants.timeStamp + '.' + recNum
}

function saveAll(callback) {
  var tableNames = []
  for (name in table) {
    tableNames.push(name)
  }
  async.forEachSeries(tableNames, save, function(err) {
    return callback(err)
  })
}

var saveTo = {
  file:
    // save to a JSON file ready to load via push
    function (tableName, callback) {
      var fileName = options.out + '/' + tableName + '.json'
      fs.writeFileSync(fileName, JSON.stringify(table[tableName]))
      log(table[tableName].length + ' ' + tableName)
      return callback()
    },
  db:
    // save in bulk via mongoskin bypassing schema validation
    function (tableName, callback) {
      var collection = db.collection(tableName)
      collection.insert(table[tableName], {safe: true}, function(err, docs) {
        log(table[tableName].length + ' ' + tableName)
        return callback(err)
      })
    },
  dbValidate:
    // save via mongoose validating each record against mongoose schema
    function (tableName, callback) {
      var model = mdb.models[tableName]

      async.forEachSeries(table[tableName], saveRow, function(err) {
        log(table[tableName].length + ' ' + tableName)
        return callback()
      })

      function saveRow(row, cb) {
        var mongooseDoc = new model(row)
        mongooseDoc.save(function(err) {
          return cb(err)
        })
      }
    }
}
