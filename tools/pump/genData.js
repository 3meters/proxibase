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
var entityCount = 0
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
  genEntityRecords([0], null, options.beacons, util.statics.typeBeacon, null)
  log('generating places')
  genEntityRecords(beaconIds, tableIds['entities'], options.epb, util.statics.typePlace, util.statics.typeProximity)
  log('generating posts')
  genEntityRecords(placeIds, tableIds['entities'], options.spe, util.statics.typePost, util.statics.typePost)
  log('generating applinks')
  genEntityRecords(placeIds, tableIds['entities'], options.ape, util.statics.typeApplink, util.statics.typeApplink)
  
  var placeAndPostIds = placeIds.concat(postIds)
  log('generating comments')
  genEntityRecords(placeAndPostIds, tableIds['entities'], options.cpe, util.statics.typeComment, util.statics.typeComment)

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

  table['entities'] = table['entities'] || []
  table['links'] = table['links'] || []

  for (var p = 0; p < parentIds.length; p++) {
    for (var i = 0; i < count; i++) {

      var newEnt = {}
      if (entityType === util.statics.typeBeacon) newEnt = constants.getDefaultRecord('entities_beacon')
      if (entityType === util.statics.typePlace) newEnt = constants.getDefaultRecord('entities_place')
      if (entityType === util.statics.typeApplink) newEnt = constants.getDefaultRecord('entities_applink')
      if (entityType === util.statics.typePost) newEnt = constants.getDefaultRecord('entities_post')
      if (entityType === util.statics.typeComment) newEnt = constants.getDefaultRecord('entities_comment')

      // Entity
      if (entityType === util.statics.typeBeacon) {
        newEnt._id = testUtil.genBeaconId(i)
        newEnt.beacon = util.clone(newEnt.beacon)
        newEnt.beacon.bssid = newEnt._id.substring(5)
        newEnt.beacon.ssid = newEnt.beacon.ssid + ' ' + (entityCount + 1)
        newEnt._owner = util.adminUser._id
      }
      else {
        newEnt._id = testUtil.genId('entities', entityCount)
      }
      newEnt.name = newEnt.name + ' ' + (entityCount + 1)
      newEnt._creator = newEnt._modifier = testUtil.genId('users', (entityCount % options.users))

      table['entities'].push(newEnt)
      entityCount++

      if (entityType !== util.statics.typeBeacon) {

        // Link
        var newLink = constants.getDefaultRecord('links')
        newLink._id = testUtil.genId('links', linkCount)
        newLink.type = linkType
        newLink._from = newEnt._id
        newLink.fromCollectionId = tableIds['entities']
        newLink._to = parentIds[p]
        newLink.toCollectionId = parentCollectionId
        if (entityType === util.statics.typeComment) {
          newLink.strong = true
        }
        if (entityType === util.statics.typeProximity) {
          newLink.proximity = { primary: true, signal: -80 }
          newLink._owner = util.adminUser._id
        }

        table['links'].push(newLink)
        linkCount++

        // Like
        if (entityType === util.statics.typePlace) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.likes) break;
            var likeLink = constants.getDefaultRecord('links')
            likeLink._id = testUtil.genId('links', linkCount)

            likeLink.type = util.statics.typeLike
            likeLink._from = testUtil.genId('users', u)
            likeLink._to = newEnt._id

            likeLink.fromCollectionId = tableIds['users']
            likeLink.toCollectionId = tableIds['entities']
            table['links'].push(likeLink)        
            linkCount++
          }
        }

        // Watch
        if (entityType === util.statics.typePlace) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.watch) break;
            var watchLink = constants.getDefaultRecord('links')
            watchLink._id = testUtil.genId('links', linkCount)

            watchLink.type = util.statics.typeWatch
            watchLink._from = testUtil.genId('users', u)
            watchLink._to = newEnt._id

            watchLink.fromCollectionId = tableIds['users']
            watchLink.toCollectionId = tableIds['entities']

            table['links'].push(watchLink)        
            linkCount++
          }
        }
      }

      if (entityType === util.statics.typeBeacon) beaconIds.push(newEnt._id)
      if (entityType === util.statics.typePlace) placeIds.push(newEnt._id)
      if (entityType === util.statics.typeApplink) applinkIds.push(newEnt._id)
      if (entityType === util.statics.typePost) postIds.push(newEnt._id)
      if (entityType === util.statics.typeComment) commentIds.push(newEnt._id)

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
