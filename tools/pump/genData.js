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
  util = require('../../lib/util'),
  log = util.log,
  constants = require('../../test/constants'),
  testUtil = require('../../test/util'),
  tableIds = constants.tableIds,
  goose = require('../../lib/goose'), // Wraps mongoose.js
  table = {},                         // Map of tables to be generated
  startTime,                          // Elapsed time counter
  db,                                 // Mongoskin connection object
  gdb,                                // Mongoose connection object
  save,                               // Save function
  options = {                         // Default options
    users: 3,                         // Count of users
    beacons: 3,                       // Count of beacons
    epb: 5,                           // Entites per beacon
    spe: 5,                           // Subentities (aka children) per beacon
    cpe: 5,                           // Comments per entity
    database: 'proxTest',             // Database name
    validate: false,                  // Validate database data against mongoose schema
    files: false,                     // Output to JSON files rather than to datbase
    out: 'files'                      // File output directory
  }

module.exports = function(profile, callback) {

  startTime = new Date().getTime() // start program timer

  for (key in profile) {
    options[key] = profile[key]
  }

  if (options.files) {
    // save to files
    if (!path.existsSync(options.out)) fs.mkdirSync(options.out)
    log('Saving to files...')
    save = saveTo.file
    run(callback)
  }

  else {
    // save to database
    var config = util.findConfig()            // Use the default server database connection
    config.db.database = options.database     // Override database name
    var dbUri = config.db.host + ':' + config.db.port +  '/' + config.db.database

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
        ensureAdminUser(callback) 
      })
    })
  }
}

// Ensure the database has the indexes defined by the service's models
function ensureIndices(config, callback) {
  log('Creating database and ensuring indeces')
  goose.connect(config, function(err, connection) {
    if (err) throw err
    gdb = connection
    // When the following dummy query is fired mongoose.js will connect to the db and
    // ensure that the indeces defined in prox/lib/models are defined in the database
    gdb.models.users.find({_id:-1}, function(err) {
      if (err) throw err
      log('Database Ok\nSaving to database...')
      return callback(err)
    })
  })
}


function ensureAdminUser(callback) {
  util.ensureAdminUser(gdb, function(err, adminUser) {
    if (err) throw err
    if (!adminUser) throw new Error('Could not create admin user')
    run(callback) 
  })
}


function run(callback) {
  genUsers()
  genDocuments()
  genBeacons()
  genEntities()
  genChildEntities()
  saveAll(function(err) {
    if (err) throw err
    if (!options.files) {
      db.close()
      gdb.close()
    }
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('genData finished in ' + elapsedTime + ' seconds')
    if (callback) return callback()
  })
}

function genUsers() {
  table.users = []
  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultRecord('users')
    user._id = testUtil.genId('users', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'doobar' + i
    table.users.push(user)
  }
}

function genDocuments() {
  table.documents = []
  table.documents.push(constants.getDefaultRecord('documents'))
}

function genBeacons() {
  table.beacons = []
  for (var i = 0; i < options.beacons; i++) {
    var beacon = constants.getDefaultRecord('beacons')
    beacon._id = testUtil.genBeaconId(i)
    beacon.ssid = beacon.ssid + ' ' + i
    beacon.bssid = beacon._id.substring(5)
    beacon._owner = beacon._creator = beacon._modifier =
      testUtil.genId('users', Math.floor((i * options.users) / options.beacons))
    // Inch our way around the world
    beacon.latitude = (beacon.latitude + (i / 1000)) % 180
    beacon.longitude = (beacon.longitude + (i / 1000)) % 180
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
      beaconNum = Math.floor(i / (isRoot ? options.epb : options.beacons * options.epb))
      ownerRecNum = Math.floor((i * options.users) / (options.beacons * options.epb))


    newEnt._id = testUtil.genId('entities', recNum)
    newEnt.root = isRoot
    newEnt.label = newEnt.title = isRoot ? 
      newEnt.title + ' ' + (recNum + 1) :
      newEnt.title + ' Child ' + (recNum + 1)
    table.entities.push(newEnt)

    // Link
    newLink = constants.getDefaultRecord('links')
    newLink._id = testUtil.genId('links', recNum)
    newLink._from = newEnt._id
    newLink.fromTableId = tableIds['entities']
    if (isRoot) {
      // Set the owner fields
      newEnt._owner = newEnt._creator = newEnt._modifier = testUtil.genId('users', ownerRecNum)
      // Link to beacon
      newLink._to = testUtil.genBeaconId(beaconNum)
      newLink.toTableId = tableIds['beacons']
    }
    else {
      // Set the owner fields
      newEnt._owner = newEnt._creator = newEnt._modifier =
        testUtil.genId('users', Math.floor(ownerRecNum / options.spe))
      // Link to parent entity
      var parentRecNum = Math.floor(i / options.spe) // yeah, this is right
      newLink._to = testUtil.genId('entities', parentRecNum)
      newLink.toTableId = tableIds['entities']
    }
    table.links.push(newLink)

    // Observation
    var newObservation = constants.getDefaultRecord('observations')
    newObservation._id = testUtil.genId('observations', recNum)
    newObservation._beacon = testUtil.genBeaconId(beaconNum)
    newObservation._entity = newEnt._id
    table.observations.push(newObservation)

    // Comments
    newEnt.comments = []
    for (var j = 0; j < options.cpe; j++) {
      newEnt.comments.push(constants.comments)
    }
  }
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
    // save via mongoskin bypassing schema validation
    function (tableName, callback) {
      var collection = db.collection(tableName)

      // save row-at-a-time because mongo chokes saving large arrays
      async.forEachSeries(table[tableName], saveRow, function(err) {
        if (err) throw err
        log(table[tableName].length + ' ' + tableName)
        return callback()
      })

      function saveRow(row, callback) {
        collection.insert(row, {safe: true}, function(err) {
          return callback(err)
        })
      }
    },
  dbValidate:
    // save via mongoose validating each record against mongoose schema
    function (tableName, callback) {
      var model = gdb.models[tableName]

      async.forEachSeries(table[tableName], saveRow, function(err) {
        if (err) log('debug: err', err)
        if (err) throw err
        log(table[tableName].length + ' ' + tableName)
        return callback()
      })

      function saveRow(row, callback) {
        var mongooseDoc = new model(row)
        mongooseDoc.__user = util.adminUser
        if (row._owner) mongooseDoc.__user = {_id: row._owner, role: 'user'}
        mongooseDoc.save(function(err) {
          return callback(err)
        })
      }
    }
}
