/*
 * Generate dummy data for a proxibase server
 *   Save to JSON files or directly to mongodb
 *   Silently overwrites existing files or tables
 */

var util = require('proxutils') // load proxibase extentions to node util
var log = util.log
var fs = require('fs')
var path = require('path')
var mongo = require('mongodb')
var async = require('async')
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var tableIds = util.statics.collectionIds
var dblib = require('../../lib/db')       // Proxdb lib
var table = {}                            // Map of tables to be generated
var startTime                             // Elapsed time counter
var db                                    // Mongodb connection object
var save                                  // Save function
var options = {                           // Default options
  users: 3,                           // Count of users
  beacons: 3,                         // Count of beacons
  epb: 5,                             // Entites per beacon
  spe: 5,                             // Subentities (aka children) per beacon
  cpe: 5,                             // Comments per entity
  database: 'proxTest',               // Database name
  validate: false,                    // Validate database data against schema
  files: false,                       // Output to JSON files rather than to datbase
  out: 'files'                        // File output directory
}


module.exports = function(profile, callback) {
  callback = callback || console.error

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
    var config = util.config           // Use the default server database connection
    config.db.database = options.database     // Override database name
    var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database + '?safe=true'

    if (options.validate) {
      log('Saving to database ' + dbUri + ' with validation')
      save = saveTo.dbValidate
    }
    else {
      log('Saving to database ' + dbUri)
      save = saveTo.db
    }

    mongo.connect(dbUri, function(err, database) {
      if (err) return callback(err)
      db = database
      db.dropDatabase(function(err) {
        if (err) throw err
        dblib.init(config, function(err, proxdb) {
          if (err) throw err
          db.close()
          db = proxdb
          return run(callback)
        })
      })
    })
  }
}


function run(callback) {
  genUsers()
  // genDocuments()  now added by server startup code
  genBeacons()
  genEntities()
  genChildEntities()
  saveAll(function(err) {
    if (err) return callback(err)
    // if (!options.files) db.close()
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    if (db) db.close()
    log('genData finished in ' + elapsedTime + ' seconds')
    return callback()
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
    beacon._creator = beacon._modifier =
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

// Makes entity and link records for parent entities (isRoot = true)
//   or child entities (isRoot = false)
function genEntityRecords(count, isRoot) {

  table.entities = table.entities || []
  table.links = table.links || []

  var countParents = options.beacons * options.epb // child Ids start after parent Ids

  for (var i = 0; i < count; i++) {
    var 
      newEnt = constants.getDefaultRecord('entities'),
      recNum = isRoot ? i : i + countParents,
      beaconNum = Math.floor(i / (isRoot ? options.epb : options.beacons * options.epb))
      ownerRecNum = Math.floor((i * options.users) / (options.beacons * options.epb))


    newEnt._id = testUtil.genId('entities', recNum)
    newEnt.name = isRoot ? 
      newEnt.name + ' ' + (recNum + 1) :
      newEnt.name + ' Child ' + (recNum + 1)
    table.entities.push(newEnt)

    // Link
    newLink = constants.getDefaultRecord('links')
    newLink._id = testUtil.genId('links', recNum)
    newLink._from = newEnt._id
    newLink.fromCollectionId = tableIds['entities']
    if (isRoot) {
      // Set the owner fields
      newEnt._creator = newEnt._modifier = testUtil.genId('users', ownerRecNum)
      // Link to beacon
      newLink._to = testUtil.genBeaconId(beaconNum)
      newLink.toCollectionId = tableIds['beacons']
    }
    else {
      // Set the owner fields
      newEnt._creator = newEnt._modifier =
        testUtil.genId('users', Math.floor(ownerRecNum / options.spe))
      // Link to parent entity
      var parentRecNum = Math.floor(i / options.spe) // yeah, this is right
      newLink._to = testUtil.genId('entities', parentRecNum)
      newLink.toCollectionId = tableIds['entities']
    }
    table.links.push(newLink)

    // Comments
    newEnt.comments = []
    for (var j = 0; j < options.cpe; j++) {
      newEnt.comments.push(constants.comment)
    }
  }
}

function saveAll(callback) {
  var tableNames = []
  for (name in table) {
    tableNames.push(name)
  }
  async.forEachSeries(tableNames, save, callback)
}

function list(tableName, fn) {
  log('tableName: ' + tableName)
  log('fn: ' + fn)
  fn()
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
    // save without schema validation
    function (tableName, callback) {
      var collection = db.collection(tableName)

      // save row-at-a-time because mongo chokes saving large arrays
      async.forEachSeries(table[tableName], saveRow, function(err) {
        if (err) return callback(err)
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
    // save with schema validation
    function (tableName, callback) {
      var collection = db.collection(tableName)

      async.forEachSeries(table[tableName], saveRow, function(err) {
        if (err) return callback(err)
        log(table[tableName].length + ' ' + tableName)
        return callback()
      })

      function saveRow(row, callback) {
        var user = util.adminUser
        if (row._creator) user = {_id: row._creator, role: 'user'}
        var options = {user: user}
        if (tableName === 'users') options.skipEmailValidation = true // skip email validation
        collection.safeInsert(row, options, function(err) {
          return callback(err)
        })
      }
    }
}
