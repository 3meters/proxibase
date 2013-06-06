/*
 * Generate dummy data for a proxibase server
 *   Save to JSON files or directly to mongodb
 *   Silently overwrites existing files or tables
 */

var util = require('proxutils') // load proxibase extentions to node util
var dblib = require('proxdb')       // Proxdb lib
var mongo = dblib.mongodb
var log = util.log
var fs = require('fs')
var path = require('path')
var async = require('async')
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var tableIds = util.statics.collectionIds
var table = {}                            // Map of tables to be generated
var startTime                             // Elapsed time counter
var db                                    // Mongodb connection object
var save                                  // Save function
var options = {                           // Default options
  users: 3,                           // Count of users
  beacons: 3,                         // Count of beacons
  epb: 5,                             // Places per beacon
  spe: 5,                             // Posts (aka children) per place
  cpe: 5,                             // Comments per post and place entity
  ape: 5,                             // Applinks per place
  database: 'proxTest',               // Database name
  validate: false,                    // Validate database data against schema
  files: false,                       // Output to JSON files rather than to datbase
  out: 'files'                        // File output directory
}
var beaconIds = []
var placeIds = []
var postIds = []
var applinkIds = []
var commentIds = []
var entityCount = { applinks: 0, beacons: 0, comments: 0, places: 0, posts: 0 }
var linkCount = 0

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

  log('generating users')
  genUsers()

  log('generating beacons')
  genEntityRecords([0], null, options.beacons, util.statics.schemaBeacon, null)

  log('generating places')
  genEntityRecords(beaconIds, tableIds['beacons'], options.epb, util.statics.schemaPlace, util.statics.typeProximity)

  log('generating posts')
  genEntityRecords(placeIds, tableIds['places'], options.spe, util.statics.schemaPost, util.statics.schemaPost)

  log('generating applinks')
  genEntityRecords(placeIds, tableIds['places'], options.ape, util.statics.schemaApplink, util.statics.schemaApplink)
  
  log('generating comments')
  var placeAndPostIds = placeIds.concat(postIds)
  genEntityRecords(placeAndPostIds, tableIds['places'], options.cpe, util.statics.schemaComment, util.statics.schemaComment)

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
  table['users'] = []
  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultRecord('users')
    user._id = testUtil.genId('users', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'doobar' + i
    table.users.push(user)
  }

  table.links = []
  for (var i = 0; i < table.users.length; i++) {
    for (var j = 0; j < table.users.length; j++) {
      if (i == j) continue

        // like
        var likeLink = constants.getDefaultRecord('links')
        likeLink._id = testUtil.genId('links', linkCount)
        likeLink.type = util.statics.typeLike
        likeLink._from = table.users[i]._id
        likeLink.fromCollectionId = tableIds['users']
        likeLink._to = table.users[j]._id
        likeLink.toCollectionId = tableIds['users']
        likeLink._owner = table.users[i]._id
        table['links'].push(likeLink)
        linkCount++

        // watch
        var watchLink = constants.getDefaultRecord('links')
        watchLink._id = testUtil.genId('links', linkCount)
        watchLink.type = util.statics.typeWatch
        watchLink._from = table.users[i]._id
        watchLink.fromCollectionId = tableIds['users']
        watchLink._to = table.users[j]._id
        watchLink.toCollectionId = tableIds['users']
        likeLink._owner = table.users[i]._id
        table['links'].push(watchLink)
        linkCount++
    }
  }
}

function genDocuments() {
  table['documents'] = []
  table['documents'].push(constants.getDefaultRecord('documents'))
}

function genEntityRecords(parentIds, parentCollectionId, count, entityType, linkType) {

  var tableName = entityType + "s"
  table[tableName] = table[tableName] || []
  table['links'] = table['links'] || []

  for (var p = 0; p < parentIds.length; p++) {
    for (var i = 0; i < count; i++) {

      var newEnt = constants.getDefaultRecord(tableName)

      // Entity
      if (entityType === util.statics.schemaBeacon) {
        newEnt._id = testUtil.genBeaconId(i)
        newEnt.bssid = newEnt._id.substring(5)
        newEnt.ssid = newEnt.ssid + ' ' + (entityCount[tableName] + 1)
        newEnt._owner = util.adminUser._id
      }
      else {
        newEnt._id = testUtil.genId(tableName, entityCount[tableName])
      }
      newEnt.name = newEnt.name + ' ' + (entityCount[tableName] + 1)
      newEnt._creator = newEnt._modifier = testUtil.genId('users', (entityCount[tableName] % options.users))

      table[tableName].push(newEnt)
      entityCount[tableName]++

      if (entityType !== util.statics.schemaBeacon) {

        // Link
        var newLink = constants.getDefaultRecord('links')
        newLink._id = testUtil.genId('links', linkCount)
        newLink.type = linkType
        newLink._from = newEnt._id
        newLink.fromCollectionId = tableIds[tableName]
        newLink._to = parentIds[p]
        newLink.toCollectionId = parentCollectionId
        newLink._owner = newEnt._creator


        if (entityType === util.statics.schemaComment) {
          newLink.strong = true
        }

        if (entityType === util.statics.schemaPlace) {
          newLink.proximity = { primary: true, signal: -80 }
          newLink._owner = util.adminUser._id
        }

        table['links'].push(newLink)
        linkCount++

        // Like
        if (entityType === util.statics.schemaPlace) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.likes) break;
            var likeLink = constants.getDefaultRecord('links')
            likeLink._id = testUtil.genId('links', linkCount)

            likeLink.type = util.statics.typeLike
            likeLink._from = testUtil.genId('users', u)
            likeLink._to = newEnt._id

            likeLink.fromCollectionId = tableIds['users']
            likeLink.toCollectionId = tableIds[tableName]
            likeLink._owner = testUtil.genId('users', u)

            table['links'].push(likeLink)        
            linkCount++
          }
        }

        // Watch
        if (entityType === util.statics.schemaPlace) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.watch) break;
            var watchLink = constants.getDefaultRecord('links')
            watchLink._id = testUtil.genId('links', linkCount)

            watchLink.type = util.statics.typeWatch
            watchLink._from = testUtil.genId('users', u)
            watchLink._to = newEnt._id

            watchLink.fromCollectionId = tableIds['users']
            watchLink.toCollectionId = tableIds[tableName]
            likeLink._owner = testUtil.genId('users', u)

            table['links'].push(watchLink)        
            linkCount++
          }
        }
      }

      if (entityType === util.statics.schemaBeacon) beaconIds.push(newEnt._id)
      if (entityType === util.statics.schemaPlace) placeIds.push(newEnt._id)
      if (entityType === util.statics.schemaApplink) applinkIds.push(newEnt._id)
      if (entityType === util.statics.schemaPost) postIds.push(newEnt._id)
      if (entityType === util.statics.schemaComment) commentIds.push(newEnt._id)

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
        collection.safeInsert(row, options, function(err) {
          return callback(err)
        })
      }
    }
}
