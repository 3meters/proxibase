/*
 * Generate dummy data for a proxibase tests
 */

// var util = require('proxutils') // load proxibase extentions to node util
var dblib = require('proxdb')       // Proxdb lib
var mongo = dblib.mongodb
var log = util.log
var fs = require('fs')
var path = require('path')
var async = require('async')
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var clMap = {}                            // Map of collections to be generated
var startTime                             // Elapsed time counter
var db                                    // Mongodb connection object
var options = {                           // Default options
  users: 3,                           // Count of users
  beacons: 3,                         // Count of beacons
  epb: 5,                             // Places per beacon
  spe: 5,                             // Posts (aka children) per place
  cpe: 5,                             // Comments per post and place entity
  ape: 5,                             // Applinks per place
  database: 'proxTest',               // Database name
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

  var config = util.config           // Use the default server database connection
  config.db.database = options.database     // Override database name
  var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database

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

function run(callback) {

  log('generating users')
  genUsers()

  log('generating beacons')
  genEntityRecords([0], options.beacons, 'beacons', null)

  log('generating places')
  genEntityRecords(beaconIds, options.epb, 'places', util.statics.typeProximity)

  log('generating posts')
  genEntityRecords(placeIds, options.spe, 'posts', util.statics.typeContent)

  log('generating applinks')
  genEntityRecords(placeIds, options.ape, 'applinks', util.statics.typeContent)

  log('generating comments')
  var placeAndPostIds = placeIds.concat(postIds)
  genEntityRecords(placeAndPostIds, options.cpe, 'comments', util.statics.typeContent)

  saveAll(function(err) {
    if (db) db.close()
    if (err) return callback(err)
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('genData finished in ' + elapsedTime + ' seconds')
    return callback()
  })
}

function genUsers() {
  clMap['users'] = []
  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultRecord('users')
    user._id = testUtil.genId('users', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'doobar' + i
    clMap.users.push(user)
  }

}

function genDocuments() {
  clMap['documents'] = []
  clMap['documents'].push(constants.getDefaultRecord('documents'))
}

function genEntityRecords(parentIds, count, collection, linkType) {

  clMap[collection] = clMap[collection] || []
  clMap['links'] = clMap['links'] || []

  for (var p = 0; p < parentIds.length; p++) {
    for (var i = 0; i < count; i++) {

      var newEnt = constants.getDefaultRecord(collection)

      // Entity
      if ('beacons' === collection) {
        newEnt._id = testUtil.genBeaconId(i)
        newEnt.bssid = newEnt._id.substring(5)
        newEnt.ssid = newEnt.ssid + ' ' + (entityCount[collection] + 1)
      }
      else {
        newEnt._id = testUtil.genId(collection, entityCount[collection])
      }
      newEnt.name = newEnt.name + ' ' + (entityCount[collection] + 1)
      newEnt._creator = newEnt._modifier = testUtil.genId('users', (entityCount[collection] % options.users))
      newEnt._owner = newEnt._creator

      clMap[collection].push(newEnt)
      entityCount[collection]++

      if ('beacons' !== collection) {

        // Link
        var newLink = constants.getDefaultRecord('links')
        newLink._id = testUtil.genId('links', linkCount)
        newLink.type = linkType
        newLink._from = newEnt._id
        newLink._to = parentIds[p]
        newLink._owner = newEnt._owner

        switch (collection) {
          case 'comments':
          case 'posts':
          case 'applinks':
            newLink.strong = true
        }

        if ('places' === collection) {
          newLink.proximity = { primary: true, signal: -80 }
        }

        clMap['links'].push(newLink)
        linkCount++

        // Create
        var createLink = constants.getDefaultRecord('links')
        createLink._id = testUtil.genId('links', linkCount)

        createLink.type = 'create'
        createLink._from = newEnt._creator
        createLink._to = newEnt._id
        createLink._owner = newEnt._creator

        clMap['links'].push(createLink)
        linkCount++

        // Like
        if ('places' === collection) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.likes) break;
            var likeLink = constants.getDefaultRecord('links')
            likeLink._id = testUtil.genId('links', linkCount)

            likeLink.type = util.statics.typeLike
            likeLink._from = testUtil.genId('users', u)
            likeLink._to = newEnt._id
            likeLink._owner = likeLink._from

            clMap['links'].push(likeLink)
            linkCount++
          }
        }

        // Watch
        if ('places' === collection) {
          for (var u = 0; u < options.users; u++) {
            if (u >= options.watch) break;
            var watchLink = constants.getDefaultRecord('links')
            watchLink._id = testUtil.genId('links', linkCount)

            watchLink.type = util.statics.typeWatch
            watchLink._from = testUtil.genId('users', u)
            watchLink._to = newEnt._id
            watchLink._owner = watchLink._from

            clMap['links'].push(watchLink)
            linkCount++
          }
        }
      }

      switch (collection) {
        case 'beacons':  beaconIds.push(newEnt._id);   break
        case 'places':   placeIds.push(newEnt._id);    break
        case 'applinks': applinkIds.push(newEnt._id);  break
        case 'posts':    postsIds.push(newEnt._id);    break
        case 'comments': commentIds.push(newEnt._id);  break
      }

    }
  }
}

function saveAll(callback) {
  var collections = []
  var linkTable
  for (name in clMap) {
    name === 'links' ? linkTable = true : collections.push(name)
  }
  async.forEachSeries(collections, save, function(err) {
    if (err) return callback(err)
    if (linkTable) return save('links', callback)
    callback()
  })
}


// save with schema validation
function save(collection, callback) {

  async.forEachSeries(clMap[collection], saveRow, function(err) {
    if (err) return callback(err)
    log(clMap[collection].length + ' ' + collection)
    return callback()
  })

  function saveRow(row, callback) {
    var user = util.adminUser
    if (row._creator) user = {_id: row._creator, role: 'user'}
    var options = {user: user}
    db.collection(collection).safeInsert(row, options, function(err) {
      return callback(err)
    })
  }
}
