/**
 * db/index.js
 *
 * init(config, cb)
 *   Connects to a mongo database
 *   Loads the schemas
 *   Inits the schemas, ensuruing indexes
 *   Ensures the admin user exists, creating if necessary
 *   Returns a mongodb connection object
 *
 * mongo
 *   Returns top-level mongodb object wrapped with extended methods
 *
 * createSchema
 *   Schema constructor
 *
 * schemas
 *  Returns map of all the loaded schemas
 *
 * Can be called directly without running the app server. This is useful for 
 * doing direct data manipulation using the same schema validation code as 
 * the app server's custom methods and REST API
 *
 */

var path = require('path')
var fs = require('fs')
var assert = require('assert')
var crypto = require('crypto')
var mongo = require('mongodb')
var async = require('async')

// If called from test or otherwise outside the context of the
// proxibase server load the proxibase server globals
try { var u = util }
catch (e) { require('../global') }

var mongoschema = require('./mongoschema')
var mongoread = require('./mongoread')
var mongowrite = require('./mongowrite')

function init(config, cb) {

  assert(config && config.db && cb, 'Invalid call to db init')

  var options = config.db.options || {}
  options.auto_reconnect = true
  options.safe = true

  var server = new mongo.Server(config.db.host, config.db.port, options)
  var db = new mongo.Db(config.db.database, server, {safe:true})
  db.open(function(err, db) {
    if (err) return cb(err)
    loadSchemas()
  })

  // Load Schemas
  function loadSchemas() {

    schemaDir = path.join(__dirname, '../schemas')

    var schemas = []

    // Load each schema by file name
    fs.readdirSync(schemaDir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(schemaDir, fileName))
        if (tipe.isFunction(module.getSchema)) {
          var schema = module.getSchema()
          if (tipe.isError(schema)) return cb(schema)
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
      if (err) return cb(err)
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
      if (err) return cb(err)
      log('Ensured admin user')
      cb(err, db)
    }
  }
}

exports.init = init
exports.createSchema = mongoschema.createSchema
exports.mongodb = mongo
