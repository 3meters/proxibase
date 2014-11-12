/*
 * Generate dummy data for a proxibase server
 *   Silently overwrites existing collections
 */

var fs = require('fs')
var path = require('path')
var async = require('async')
var util = require('proxutils') // load proxibase extentions to node util, adds globals
var mongo = require('proxdb')       // Proxdb lib, inits schemas
var _schemas = statics.schemas
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var startTime         // Elapsed time counter

var options = {       // Default options
  users: 10,          // Count of users
  ppu: 5,             // Patches per user
  bpp: 5,             // Beacons per patch
  ppp: 1,             // Places per patch
  mpp: 5,             // Messages per patch
  app: 5,             // Applinks per patch
  database: null,     // Database name
}

var users = []
var docs = {}
var links = []


module.exports = function(profile, cb) {

  cb = cb || function(err, result) {
    if (err) return console.error(err.stack||err)
    if (result) console.log(result)
  }

  startTime = new Date().getTime() // start program timer

  for (key in profile) {
    options[key] = profile[key]
  }

  // Configure
  var config = util.config
  if (options.database) config.db.database = options.database
  else config.db.database += 'Template'

  var dbUri = 'mongodb://' + config.db.host + ':' + config.db.port +  '/' + config.db.database

  log('Saving to database ' + dbUri + ' with validation')

  mongo.connect(dbUri, function(err, database) {
    if (err) return cb(err)
    db = database
    db.dropDatabase(function(err) {
      if (err) throw err
      var schemaPath = path.join(__dirname, '../../lib/schemas')  // fragile
      mongo.initDb(config.db, function(err, proxdb) {
        if (err) throw err
        db.close()
        db = proxdb
        return run(cb)
      })
    })
  })
}

function run(cb) {

  genUsers()

  users.forEach(function(user, iUser) {
    genEntities(user, iUser, 'patch', options.ppu, [user], [{from: 'watch'}], true)
    genEntities(user, iUser, 'beacon', options.bpp, user.ents.patches, [{from: 'proximity'}], false)
    genEntities(user, iUser, 'place', options.ppp, user.ents.patches, [{from: 'proximity'}], false)
    genEntities(user, iUser, 'message', options.mpp, user.ents.patches, [{to: 'content'}], true)
    genEntities(user, iUser, 'applink', options.app, user.ents.patches, [{to: 'content'}], false)
  })

  // Unpack the entities stashed under each user
  users.forEach(function(user) {
    for (var clName in user.ents) {
      docs[clName] = docs[clName] || []
      user.ents[clName].forEach(function(ent) {
        docs[clName].push(ent)
      })
    }
    delete user.ents
  })

  saveAll(function(err) {
    if (db) db.close()
    if (err) return cb(err)
    var elapsedTime = ((new Date().getTime()) - startTime) / 1000
    log('genData finished in ' + elapsedTime + ' seconds')
    return cb()
  })
}

function genUsers() {
  for (var i = 0; i < options.users; i++) {
    var user = constants.getDefaultDoc('user')
    user._id = testUtil.genId('user', i)
    user.name = 'Test User ' + (i + 1)
    user.email = 'testuser' + (i + 1) + '@3meters.com'
    user.password = 'password' + (i + 1)
    user.ents = {}  // map of entities this user will create
    users.push(user)
  }
}


function genEntities(user, iUser, schemaName, count, linkedEnts, linkSpecs, makeCreateLinks) {

  var schema = db.safeSchemas[schemaName]
  var clName = schema.collection
  user.ents[clName] = []
  var userEnts = user.ents[clName]

  for (var p = 0; p < linkedEnts.length; p++) {
    for (var i = 0; i < count; i++) {

      var seed = (iUser * count * linkedEnts.length) + (p * count) + i
      // log({iUser: iUser, count: count, p: i, i: i, seed: seed})
      var newEnt = constants.getDefaultDoc(schemaName)
      if (schemaName === statics.schemaBeacon) {
        newEnt._id = testUtil.genBeaconId(seed)
        newEnt.bssid = newEnt._id.slice(3)
        newEnt.ssid = newEnt.ssid + ' ' + seed
      }
      else {
        newEnt._id = testUtil.genId(schemaName, seed)
      }
      newEnt.name = newEnt.name + ' ' + seed
      newEnt._creator = user._id

      userEnts.push(newEnt)

      linkSpecs.forEach(function(linkSpec) {
        var link
        if (linkSpec.to) {
          link = {
            _to: linkedEnts[p]._id,
            _from: newEnt._id,
            type: linkSpec.to,
          }
        }
        if (linkSpec.from) {
          link = {
            _to: newEnt._id,
            _from: linkedEnts[p]._id,
            type: linkSpec.from,
          }
        }
        link._id = testUtil.genId('link', links.length),
        link._creator = newEnt._creator
        links.push(link)
      })

      // Optionally add a create link from the user
      if (makeCreateLinks) {
        links.push({
          _id:    testUtil.genId('link', links.length),
          _to:    newEnt._id,
          _from:  user._id,
          type:   'create',
          _creator:  user._id,
        })
      }
    }
  }
}


function saveAll(cb) {

  // An ordered list of collection names
  var clNames = []

  clNames.push('users')
  for (var clName in docs) {
    clNames.push(clName)
  }
  clNames.push('links')

  docs.users = users
  docs.links = links

  async.forEachSeries(clNames, save, cb)

  function save(clName, cb) {
    var collection = db.collection(clName)

    async.forEachSeries(docs[clName], saveRow, function(err) {
      if (err) return cb(err)
      log(docs[clName].length + ' ' + clName)
      return cb()
    })

    function saveRow(row, cb) {
      var user = (row._creator)
        ? {_id: row._creator, role: 'user'}
        : util.adminUser
      collection.safeInsert(row, {user: user, ip: '127.0.0.1'}, function(err) {
        return cb(err)
      })
    }
  }
}
