/*
 * db/index.js
 *
 * init(config, callback)
 *   Connects to a mongo database
 *   Loads the schemas
 *   Inits the schemas, ensuruing indexes
 *   Ensures the admin user exists, creating if necessary
 *   Returns a mongodb connection object
 *
 * Can be called directly without running the app server. This is useful for 
 * doing direct data manipulation using the same schema validation code as 
 * the app server's custom methods and REST API
 *
 */

var util = require('utils')
var log = util.log
var path = require('path')
var fs = require('fs')
var assert = require('assert')
var crypto = require('crypto')
var mongo = require('mongodb')
var mongosafe = require('./mongosafe')
var mongoschema = require('./mongoschema')
var async = require('async')


// If called by someone other than proxibase load the proxibase extensions
if (!util.truthy) require('../../extend')

exports.createSchema = mongoschema.createSchema

exports.init = function(config, callback) {

  assert(config && config.db && callback, 'Invalid call to db init')

  var options = config.db.options || {}
  options.auto_reconnect = true
  options.safe = true

  var server = new mongo.Server(config.db.host, config.db.port, options)
  var db = new mongo.Db(config.db.database, server, {safe:true})
  db.open(function(err, db) {
    if (err) return callback(err)
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
        if (typeof module.getSchema === 'function') {
          var schema = module.getSchema()
          schema.name = path.basename(fileName, '.js')
          schemas.push(schema)
        }
      }
    })

    schemas.sort(function(a, b) { return a.id - b.id }) // ascending by id

    async.forEachSeries(schemas, initSchema, finish)
    function initSchema(schema, next) {
      mongoschema.initSchema(db, schema, next)
    }

    function finish(err) {
      if (err) return callback(err)
      log('Ensured indexes')
      if (config.log > 1) log('Schemas:', db.schemas)
      ensureAdminUser()
    }
  }

  // Ensure that the admin user exists in the database
  function ensureAdminUser() {
    var users = db.collection('users')

    users.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
      if (err) return finish(err)
      if (adminUser) return finish()
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
            finish()
          })
        })
      }
    })

    function finish(err) {
      if (err) return callback(err)
      log('Ensured admin user')
      callback(err, db)
    }
  }
}

