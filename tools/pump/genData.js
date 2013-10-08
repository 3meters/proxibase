/*
<<<<<<< HEAD
 * Generate dummy data for a proxibase server
 *   Silently overwrites existing collections
=======
 * Generate dummy data for a proxibase tests
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
 */

var fs = require('fs')
var path = require('path')
var async = require('async')
var util = require('proxutils') // load proxibase extentions to node util
var log = util.log
var statics = util.statics
var _schemas = statics.schemas
var dblib = require('proxdb')       // Proxdb lib
var mongo = dblib.mongodb
var db                                    // Mongodb connection object
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
<<<<<<< HEAD
var collection = {}                       // Map of collections to be generated
var startTime                             // Elapsed time counter
=======
var clMap = {}                            // Map of collections to be generated
var startTime                             // Elapsed time counter
var db                                    // Mongodb connection object
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
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

<<<<<<< HEAD
  // Configure
  var config = util.config                  // Use the default server database connection
  config.db.database = options.database     // Override database name
  var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database

  log('Saving to database ' + dbUri + ' with validation')
=======
  var config = util.config           // Use the default server database connection
  config.db.database = options.database     // Override database name
  var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8

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
<<<<<<< HEAD
  genEntityRecords([0], null, options.beacons, statics.schemaBeacon, null)

  log('generating places')
  genEntityRecords(beaconIds, _schemas.beacon.id, options.epb, statics.schemaPlace, statics.typeProximity)

  log('generating posts')
  genEntityRecords(placeIds, _schemas.place.id, options.spe, statics.schemaPost, statics.typeContent)

  log('generating applinks')
  genEntityRecords(placeIds, _schemas.places.id, options.ape, statics.schemaApplink, statics.typeContent)

  log('generating comments')
  var placeAndPostIds = placeIds.concat(postIds)
  genEntityRecords(placeAndPostIds, _schemas.place.id, options.cpe, statics.schemaComment, statics.typeContent)
=======
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
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8

  saveAll(function(err) {
    if (db) db.close()
    if (err) return callback(err)
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('genData finished in ' + elapsedTime + ' seconds')
    return callback()
  })
}

function genUsers() {
<<<<<<< HEAD
  collection['users'] = []
=======
  clMap['users'] = []
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultRecord('users')
    user._id = testUtil.genId('user', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'doobar' + i
<<<<<<< HEAD
    collection.users.push(user)
  }

  collection.links = []
  for (var i = 0; i < collection.users.length; i++) {
    for (var j = 0; j < collection.users.length; j++) {

      if (i == j) continue   // Don't like or watch yourself

      // like
      var link = {
        _id:            testUtil.genId('link', linkCount),
        type:           'like',
        _from:          collection.users[i]._id,
        _to:            collection.users[j]._id,
      }
      collection['links'].push(link)
      linkCount++

      // watch
      link._id = testUtil.genId('link', linkCount),
      link.type = 'watch'
      collection['links'].push(link)
      linkCount++
    }
  }
}

function genDocuments() {
  collection.documents = []
  collection.documents.push(constants.getDefaultRecord('documents'))
}

function genEntityRecords(parentIds, parentSchema, count, entitySchema, linkType) {

  collection[entitySchema] = collection[entitySchema] || []
  collection.links = collection.links || []
=======
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
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8

  for (var p = 0; p < parentIds.length; p++) {
    for (var i = 0; i < count; i++) {

<<<<<<< HEAD
      var newEnt = constants.getDefaultRecord(entitySchema)

      // Entity
      if (entitySchema === statics.schemaBeacon) {
        newEnt._id = testUtil.genBeaconId(i)
        newEnt.bssid = newEnt._id.substring(5)
        newEnt.ssid = newEnt.ssid + ' ' + (entityCount[entitySchema] + 1)
        newEnt._owner = util.adminUser._id
      }
      else {
        newEnt._id = testUtil.genId(entitySchema, entityCount[entitySchema])
      }
      newEnt.name = newEnt.name + ' ' + (entityCount[entitySchema] + 1)
      newEnt._creator = newEnt._modifier = testUtil.genId('user', (entityCount[entitySchema] % options.users))

      collection[entitySchema].push(newEnt)
      entityCount[entitySchema]++

      if (entitySchema !== statics.schemaBeacon) {
=======
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
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8

        // Link
        var newLink = constants.getDefaultRecord('links')
        newLink._id = testUtil.genId('link', linkCount)
        newLink.type = linkType
        newLink._from = newEnt._id
<<<<<<< HEAD
        newLink.fromCollectionId = _schemas[entitySchema]
        newLink.fromSchema = statics.collectionSchemaMap[entitySchema]
        newLink._to = parentIds[p]
        newLink.toCollectionId = _schemas[parentSchema]
        newLink.toSchema = statics.collectionSchemaMap[parentSchema]
        newLink._owner = newEnt._creator

        if (entitySchema === statics.schemaPlace) {
=======
        newLink._to = parentIds[p]
        newLink._owner = newEnt._owner

        switch (collection) {
          case 'comments':
          case 'posts':
          case 'applinks':
            newLink.strong = true
        }

        if ('places' === collection) {
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
          newLink.proximity = { primary: true, signal: -80 }
        }

<<<<<<< HEAD
        collection['links'].push(newLink)
=======
        clMap['links'].push(newLink)
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
        linkCount++

        // Create
        var createLink = constants.getDefaultRecord('links')
        createLink._id = testUtil.genId('link', linkCount)

<<<<<<< HEAD
        createLink.type = statics.typeCreate
        createLink._from = newEnt._creator
        createLink.fromCollectionId = _schemas['users']
        createLink.fromSchema = statics.collectionSchemaMap['users']

        createLink._to = newEnt._id
        createLink.toCollectionId = _schemas[entitySchema]
        createLink.toSchema = statics.collectionSchemaMap[entitySchema]
        createLink._owner = newEnt._creator

        if (entitySchema === statics.schemaPlace) {
          createLink._owner = util.adminUser._id
        }

        collection['links'].push(createLink)        
        linkCount++

        // Like
        if (entitySchema === statics.schemaPlace) {
          for (var u = 0; u < options.users && u < options.likes; u++) {
=======
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
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
            var likeLink = constants.getDefaultRecord('links')
            likeLink._id = testUtil.genId('link', linkCount)

<<<<<<< HEAD
            likeLink.type = statics.typeLike
            likeLink._from = testUtil.genId('user', u)
            likeLink.fromCollectionId = _schemas['users']
            likeLink.fromSchema = statics.collectionSchemaMap['users']

            likeLink._to = newEnt._id
            likeLink.toCollectionId = _schemas[entitySchema]
            likeLink.toSchema = statics.collectionSchemaMap[entitySchema]
            likeLink._owner = testUtil.genId('user', u)

            collection['links'].push(likeLink)
=======
            likeLink.type = util.statics.typeLike
            likeLink._from = testUtil.genId('users', u)
            likeLink._to = newEnt._id
            likeLink._owner = likeLink._from

            clMap['links'].push(likeLink)
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
            linkCount++
          }
        }

        // Watch
<<<<<<< HEAD
        if (entitySchema === statics.schemaPlace) {
=======
        if ('places' === collection) {
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
          for (var u = 0; u < options.users; u++) {
            if (u >= options.watch) break;
            var watchLink = constants.getDefaultRecord('links')
            watchLink._id = testUtil.genId('link', linkCount)

<<<<<<< HEAD
            watchLink.type = statics.typeWatch
            watchLink._from = testUtil.genId('user', u)
            watchLink.fromCollectionId = _schemas['users']
            watchLink.fromSchema = statics.collectionSchemaMap['users']

            watchLink._to = newEnt._id
            watchLink.toCollectionId = _schemas[entitySchema]
            watchLink.toSchema = statics.collectionSchemaMap[entitySchema]
            likeLink._owner = testUtil.genId('user', u)

            collection['links'].push(watchLink)
=======
            watchLink.type = util.statics.typeWatch
            watchLink._from = testUtil.genId('users', u)
            watchLink._to = newEnt._id
            watchLink._owner = watchLink._from

            clMap['links'].push(watchLink)
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
            linkCount++
          }
        }
      }

<<<<<<< HEAD
      if (entitySchema === statics.schemaBeacon) beaconIds.push(newEnt._id)
      if (entitySchema === statics.schemaPlace) placeIds.push(newEnt._id)
      if (entitySchema === statics.schemaApplink) applinkIds.push(newEnt._id)
      if (entitySchema === statics.schemaPost) postIds.push(newEnt._id)
      if (entitySchema === statics.schemaComment) commentIds.push(newEnt._id)
=======
      switch (collection) {
        case 'beacons':  beaconIds.push(newEnt._id);   break
        case 'places':   placeIds.push(newEnt._id);    break
        case 'applinks': applinkIds.push(newEnt._id);  break
        case 'posts':    postsIds.push(newEnt._id);    break
        case 'comments': commentIds.push(newEnt._id);  break
      }
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8

    }
  }
}

function saveAll(callback) {
<<<<<<< HEAD
  var collectionNames = []
  var linkCollection
  for (name in collection) {
    name === 'links' ? linkCollection = true : collectionNames.push(name)
  }
  async.forEachSeries(collectionNames, save, function(err) {
=======
  var collections = []
  var linkTable
  for (name in clMap) {
    name === 'links' ? linkTable = true : collections.push(name)
  }
  async.forEachSeries(collections, save, function(err) {
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
    if (err) return callback(err)
    if (linkCollection) return save('links', callback)
    callback()
  })
}

<<<<<<< HEAD
function list(collectionName, fn) {
  log('collectionName: ' + collectionName)
  log('fn: ' + fn)
  fn()
}

function save(collectionName, callback) {
  var collection = db.collection(collectionName)

  async.forEachSeries(collection[collectionName], saveRow, function(err) {
    if (err) return callback(err)
    log(collection[collectionName].length + ' ' + collectionName)
=======

// save with schema validation
function save(collection, callback) {

  async.forEachSeries(clMap[collection], saveRow, function(err) {
    if (err) return callback(err)
    log(clMap[collection].length + ' ' + collection)
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
    return callback()
  })

  function saveRow(row, callback) {
    var user = util.adminUser
    if (row._creator) user = {_id: row._creator, role: 'user'}
    var options = {user: user}
<<<<<<< HEAD
    collection.safeInsert(row, options, function(err) {
=======
    db.collection(collection).safeInsert(row, options, function(err) {
>>>>>>> b8e03e86130b31c69026c9572e259af84aff83d8
      return callback(err)
    })
  }
}
