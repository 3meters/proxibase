/*
 * db/index.js
 *
 *   Connect to a mongo database
 *   Load the schemas
 *   Init the schemas, ensuruing indexes
 *   Ensure the admin user exists, creating if necessary
 *   Returns a mongoskin connection object
 *
 * Can be called directly without running the app server. This is useful for 
 * doing direct data manipulation using the same schema validation code as 
 * the app server's custom methods and REST API
 *
 */

var util = require('util')
var log = util.log
var path = require('path')
var fs = require('fs')
var assert = require('assert')
var crypto = require('crypto')
var mongo = require('mongoskin')
var async = require('async')


// If called by someone other than proxibase load the proxibase extensions
if (!util.truthy) require('../extend')

exports.init = function(config, callback) {

  var db = mongo.db(config.db.host + ':' + config.db.port +
      '/' + config.db.database, config.db.options)
  // Connect to mongodb with a fake query to ensure the db is available
  db.collection('fake').find({_id: -1}, function(err) {
    if (err) return callback(err)
    // We have a valid connection
    loadSchemas()
  })

  // Load Schemas
  function loadSchemas() {

    schemaDir = path.join(__dirname, 'schemas')

    var schemas = []
    // Load each schema by file name
    fs.readdirSync(schemaDir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(schemaDir, fileName))
        if (module.getSchema) {
          var schema = module.getSchema()
          schema.name = path.basename(fileName, '.js')
          schemas.push(schema)
        }
      }
    })

    schemas.sort(function(a, b) { return a.id - b.id }) // ascending by id

    async.forEachSeries(schemas, initSchema, finish)
    function initSchema(schema, next) {
      db.initSchema(schema, next)
    }

    function finish(err) {
      if (err) return callback(err)
      if (config.log > 1) log('Loaded schemas:', db.schemas)
      ensureAdminUser()
    }
  }

  // Ensure that the admin user exists in the database
  function ensureAdminUser() {
    var users = db.collection('users')

    log('Ensuring admin user')
    users.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
      if (err) return finish(err)
      if (adminUser) return finish(null, adminUser)
      else {
        var newAdminUser = util.clone(util.adminUser)
        newAdminUser.password = users.hashPassword('admin')
        // Insert the admin user bypassing schema validation
        users.insert(newAdminUser, {safe: true}, function(err) {
          if (err) return finish(err)
          users.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
            if (err) return finish(err)
            if (!adminUser) return finish(new Error('Could not create admin user'))
            log('Created new admin user: ', adminUser)
            return finish(null, adminUser)
          })
        })
      }
    })

    // return a mongoskin connection to the server
    function finish(err, adminUser) {
      if (err) callback(err)
      callback(null, db)
    }
  }
}

/*
 * genId: create a mongodb _id of type String that increase over time, have few collisions
 * under load, sort reasonably, and can be read by humans. They take the form: 
 *
 *    sche.yymmdd.scnds.mil.random
 *
 *  meaning:
 *
 *    schemaId.dateUTC.secondsSinceMidnightUTC.milliseconds.randomNumber
 *
 */
exports.genId = function(schemaId, timeUTC) {

  assert(parseInt(schemaId) >= 0, "Invalid schemaId")
  timeUTC = timeUTC || getTimeUTC()

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString()
    assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s)
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0'
    }
    return zeros + s
  }

  // schemaId, integer 0-9999
  var schema = pad(schemaId, 4)

  // UTC date, YYMMDD
  var nowUTC = new Date(timeUTC)
  var year = pad((nowUTC.getFullYear() - 2000), 2)  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2) // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2)
  var dateUTC = year + month + day 

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate())
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5) // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3)
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  var id = [schema, dateUTC, secondsUTC, millisecs, rand].join('.')
  return id
}


/*
 * Take an id string and attempt to parse it into it's meaningful parts
 * Only the tableId is validated.  If it is valid, the parsedId is returned,
 * otherwise null is returned.  The rest of the id is parsed without range
 * checking and is provided only as a convenience in the well-formed case.
 */
exports.parseId = function(idStr) {
  util.log('parseID: idstr: ' + idStr)
  var collectionIdMap = util.statics.collectionIdMap
  var id = {}, sep = '.', parts = []

  idStr = String(idStr) // make sure we're working with a string

  if (idStr.indexOf(sep) < 0) {
    // not a generated id, possibly one containing a mac address
    // see if the first part looks like a table Id
    var num = parseInt(idStr, 10)
    if (collectionIdMap[num]) id.tableId = num
    else return proxErr.badSchemaId(idStr)
  }
  else {
    parts = idStr.split(sep)
    id.collectionId = parseInt(parts[0])
    if (!collectionIdMap[id.collectionId]) return proxErr.badSchemaId(idStr)
    if (parts.length === 5) {
      // Assume the rest is well-formed.  If any code ever relies on this
      // being true we should validate the constituent parts
      id.yymmdd = parts[1]
      id.secondsSinceMidnight = parseInt(parts[2], 10)
      id.miliseconds = parseInt(parts[3], 10)
      id.recNum = parseInt(parts[4], 10)
    }
  }
  util.log('id', id)
  return id
}

