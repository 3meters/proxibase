/*
 * Generate dummy data for a proxibase server
 *   Silently overwrites existing collections
 */

var fs = require('fs')
var path = require('path')
var async = require('async')
var util = require('proxutils') // load proxibase extentions to node util
var log = util.log
var statics = util.statics
var _schemas = statics.schemas
var mongo = require('proxdb')       // Proxdb lib
var db                                    // Mongodb connection object
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var docs = {                            // Map of collections to be generated
  users: [],
  beacons: [],
  places: [],
  posts: [],
  applinks: [],
  comments: [],
  links: [],
}
var startTime                             // Elapsed time counter
var options = {                           // Default options
  users: 10,                           // Count of users
  beacons: 10,                         // Count of beacons
  epb: 1,                             // Places per beacon
  spe: 5,                             // Posts (aka children) per place
  ape: 5,                             // Applinks per place
  cpe: 2,                             // Comments per post and place entity
  likes: 2,
  watch: 2,
  database: 'proxTest',               // Database name
}
var beaconIds = []
var placeIds = []
var postIds = []
var applinkIds = []
var commentIds = []
var entityCount = { applinks: 0, beacons: 0, comments: 0, places: 0, posts: 0 }

module.exports = function(profile, callback) {

  callback = callback || function(err, result) {
    if (err) return console.error(err.stack||err)
    if (result) console.log(result)
  }

  startTime = new Date().getTime() // start program timer

  for (key in profile) {
    options[key] = profile[key]
  }

  // Configure
  var config = util.config                  // Use the default server database connection
  config.db.database = options.database     // Override database name
  var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database

  log('Saving to database ' + dbUri + ' with validation')

  mongo.connect(dbUri, function(err, database) {
    if (err) return callback(err)
    db = database
    db.dropDatabase(function(err) {
      if (err) throw err
      mongo.initDb(config, function(err, proxdb) {
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
  genEntityRecords([0], options.beacons, 'beacon', null)

  log('generating places')
  genEntityRecords(beaconIds, options.epb, 'place', 'proximity')

  log('generating posts')
  genEntityRecords(placeIds, options.spe, 'post', 'content')

  log('generating applinks')
  genEntityRecords(placeIds, options.ape, 'applink', 'content')

  log('generating comments')
  var placeAndPostIds = placeIds.concat(postIds)
  genEntityRecords(placeAndPostIds, options.cpe, 'comment', 'content')

  saveAll(function(err) {
    if (db) db.close()
    if (err) return callback(err)
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('genData finished in ' + elapsedTime + ' seconds')
    return callback()
  })
}

function genUsers() {

  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultDoc('user')
    user._id = testUtil.genId('user', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'doobar' + i
    docs.users.push(user)
  }

  // Users like and watch each other
  for (var i = 0; i < docs.users.length; i++) {
    for (var j = 0; j < docs.users.length; j++) {

      if (i == j) continue   // Don't like or watch yourself

      // like
      docs.links.push({
        _id:      testUtil.genId('link', docs.links.length),
        _from:    docs.users[i]._id,
        _to:      docs.users[j]._id,
        type:     'like',
        _creator: docs.users[i]._id,
      })

      // watch
      docs.links.push({
        _id:      testUtil.genId('link', docs.links.length),
        _from:    docs.users[i]._id,
        _to:      docs.users[j]._id,
        type:     'watch',
        _creator: docs.users[i]._id,
      })
    }
  }
}

function genDocuments() {
  docs.documents.push(constants.getDefaultDoc('document'))
}

function genEntityRecords(parentIds, count, entitySchema, linkType) {

  for (var p = 0; p < parentIds.length; p++) {
    for (var i = 0; i < count; i++) {

      var newEnt = constants.getDefaultDoc(entitySchema)
      var entDocs = docs[_schemas[entitySchema].collection]

      // Entity
      if (entitySchema === statics.schemaBeacon) {
        newEnt._id = testUtil.genBeaconId(i)
        newEnt.bssid = newEnt._id.substring(5)
        newEnt.ssid = newEnt.ssid + ' ' + entDocs.length
      }
      else {
        newEnt._id = testUtil.genId(entitySchema, entDocs.length)
      }
      newEnt.name = newEnt.name + ' ' + entDocs.length
      newEnt._creator = testUtil.genId('user', (entDocs.length % options.users))

      entDocs.push(newEnt)

      // Create links
      if (entitySchema !== 'beacon') {

        var links = docs.links

        // Link
        var link = {
          _id:    testUtil.genId('link', links.length),
          _from:  newEnt._id,
          _to:    parentIds[p],
          type:   linkType,
          _creator:  newEnt._creator,
        }
        if (entitySchema === 'place') {
          link.proximity = { primary: true, signal: -80 }
        }
        links.push(link)

        // Create
        links.push({
          _id:    testUtil.genId('link', links.length),
          _from:  newEnt._creator,
          _to:    newEnt._id,
          type:   'create',
          _creator:  newEnt._creator,
        })

        if (entitySchema === 'place') {

          // Like
          for (var u = 0; u < options.users && u < options.likes; u++) {
            links.push({
              _id:      testUtil.genId('link', links.length),
              _from:    testUtil.genId('user', u),
              _to:      newEnt._id,
              type:     'like',
              _creator: testUtil.genId('user', u),
            })
          }

          // Watch
          for (var u = 0; u < options.users && u < options.watch; u++) {
            links.push({
              _id:      testUtil.genId('link', links.length),
              _from:    testUtil.genId('user', u),
              _to:      newEnt._id,
              type:     'watch',
              _creator: testUtil.genId('user', u),
            })
          }
        }
      }

      switch (entitySchema) {
        case 'beacon':  beaconIds.push(newEnt._id);   break
        case 'place':   placeIds.push(newEnt._id);    break
        case 'applink': applinkIds.push(newEnt._id);  break
        case 'post':    postIds.push(newEnt._id);    break
        case 'comment': commentIds.push(newEnt._id);  break
      }

    }
  }
}

function saveAll(callback) {
  var collectionNames = []
  var linkCollection
  for (name in docs) {
    name === 'links' ? linkCollection = true : collectionNames.push(name)
  }
  async.forEachSeries(collectionNames, save, function(err) {
    if (err) return callback(err)
    if (linkCollection) return save('links', callback)
    callback()
  })
}

function save(collectionName, callback) {
  var collection = db.collection(collectionName)

  async.forEachSeries(docs[collectionName], saveRow, function(err) {
    if (err) return callback(err)
    log(docs[collectionName].length + ' ' + collectionName)
    return callback()
  })

  function saveRow(row, callback) {
    var user = (row._creator)
      ? {_id: row._creator, role: 'user'}
      : util.adminUser
    collection.safeInsert(row, {user: user}, function(err) {
      return callback(err)
    })
  }
}
