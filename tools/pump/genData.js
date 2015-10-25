/*
 * Generate dummy data for a proxibase server
 *   Silently overwrites existing database
 */

var async = require('async')
var util = require('proxutils') // load proxibase extentions to node util, adds globals
var mongo = require('proxdb')       // Proxdb lib, inits schemas
var constants = require('../../test/constants')
var testUtil = require('../../test/util')
var startTime         // Elapsed time counter
var db


var users = []
var docs = {}
var links = []


module.exports = function(ops, cb) {

  cb = cb || function(err, result) {
    if (err) return console.error(err.stack||err)
    if (result) console.log(result)
  }

  var spec = {
    host:     {type: 'string', default: 'localhost'},
    port:     {type: 'number', default: 27017},
    database: {type: 'string', required: true},
    profile:  {type: 'object', required: true, value: {
      users:  {type: 'number', required: true},
      ppu:    {type: 'number', required: true},
      bpp:    {type: 'number', required: true},
      ppp:    {type: 'number', required: true},
      mpp:    {type: 'number', required: true},
    }},
  }

  var err = scrub(ops, spec)
  if (err) return cb(err.stack)

  startTime = new Date().getTime() // start program timer

  // Connect
  var dbUri = 'mongodb://' + ops.host + ':' + ops.port +  '/' + ops.database
  log('Saving to database ' + dbUri)

  mongo.connect(dbUri, function(err, oldDb) {
    if (err) return cb(err)
    oldDb.dropDatabase(function(err) {
      if (err) throw err
      mongo.initDb(ops, function(err, proxdb) {
        if (err) throw err
        oldDb.close()
        db = proxdb    // module global
        run(ops, cb)
      })
    })
  })
}

function run(ops, cb) {

  var profile = ops.profile
  genUsers()

  users.forEach(function(user, iUser) {
    genEntities(user, iUser, 'patch', profile.ppu, [users], [])
    genEntities(user, iUser, 'beacon', profile.bpp, user.ents.patches, [{from: 'proximity'}])
    genEntities(user, iUser, 'place', profile.ppp, user.ents.patches, [{from: 'proximity'}])
    genEntities(user, iUser, 'message', profile.mpp, user.ents.patches, [{to: 'content'}])
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

  function genUsers() {
    for (var i = 0; i < profile.users; i++) {
      var user = constants.getDefaultDoc('user')
      user._id = testUtil.genId('user', i)
      user.name = 'Test User ' + (i + 1)
      user.email = 'testuser' + (i + 1) + '@3meters.com'
      user.password = 'password' + (i + 1)
      user.ents = {}  // map of entities this user will create
      users.push(user)
    }
  }


  function genEntities(user, iUser, schemaName, count, linkedEnts, linkSpecs) {

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

    async.forEachSeries(clNames, save, finish)

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
        if (user._id === util.adminUser._id && clName === 'users') {
          row._creator = row._id
          row._modifier = row._id
        }
        collection.safeInsert(row, {user: user, ip: '127.0.0.1', tag: 'genData'}, cb)
      }
    }

    function finish(err) {
      db.close(function(dbCloseErr) {
        cb(err||dbCloseErr)
      })
    }
  }
}
