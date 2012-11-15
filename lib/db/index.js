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
var mongosafe = require('./mongosafe')
var mongo = require('mongoskin')
var async = require('async')


// If called by someone other than proxibase load the proxibase extensions
if (!util.truthy) require('../extend')

exports.createSchema = mongosafe.createSchema

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
      mongosafe.initSchema(db, schema, next)
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

