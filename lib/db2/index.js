/*
 * db/index.js
 *
 *   Connect to a mongo database
 *   Load the schemas
 *   Ensure the indexes
 *   Ensure the admin user exists, creating him if necessary
 *   Returns a mongoskin connection object
 *
 * Can be called directly without running the app server. This is useful for 
 * doing direct data manipulation using the same schema validation code as 
 * the app server's custom methods and REST API
 *
 */

var util = require('util')
  , log = util.log
  , mongoskin = require('mongoskin')
  , async = require('async')
  , path = require('path')
  , fs = require('fs')
  , methods = require('./methods')

// If called by someone other than proxibase load the proxibase extensions
if (!util.truthy) require('../extend')

exports.init = function(config, callback) {

  var connection = mongoskin.db( config.db.host + ':' +
      config.db.port +  '/' + config.db.database, config.db.options)

  // Connect to mongodb with a fake query to ensure the db is available
  connection.collection('fake').find({_id: -1}, function(err) {
    if (err) return callback(err)
    // We have a valid connection
    loadSchemas()
  })

  // Load Schemas
  function loadSchemas() {

    connection.schemas = {}
    schemaDir = path.join(__dirname, 'schemas')

    var schemas = []
    // Load each schema by file name
    fs.readdirSync(schemaDir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(schemaDir, fileName))
        if (module.getSchema) {
          var schemaName = path.basename(fileName, '.js')
          var schema = module.getSchema()
          schema.name = schemaName
          connection.bind(schemaName, schema.methods) // from mongoskin
          schemas.push(schema)
        }
      }
    })
    // Sort schemas ascending by id then add to the connection
    schemas.sort(function(a, b) { return a.id - b.id })
    schemas.forEach(function(schema) {
      connection.schemas[schema.name] = schema
    })

    // Load all references into convenience maps on each schema
    for (var schemaName in connection.schemas) {
      var schema = connection.schemas[schemaName]
      schema.refParents = {}
      schema.refChildren = {}
      var fields = schema.fields
      for (var fieldName in fields) {
        var field = fields[fieldName]
        if (field.ref) {
          if (!connection.schemas[field.ref]) {
            throw new Error('Invalid ref ' + field.ref + ' in schema ' +
                schemaName + '.' + fieldName)
          }
          else {
            var parentName = field.ref
            schema.refParents[fieldName] = parentName
            if (!connection.schemas[parentName].refChildren[schemaName])
              connection.schemas[parentName].refChildren[schemaName] = []
            connection.schemas[parentName].refChildren[schemaName].push(fieldName)
          }
        }
      }
    }
    log('Loaded schemas')
    if (config.log > 0) log(connection.schemas)
    ensureIndexes()
  }

  // Ensure all indexes in an asyncronous series
  function ensureIndexes() {
    // build a single array of all indexes to create for all collections
    var indexes = []
    for (var key in connection.schemas) {
      connection.schemas[key].indexes.forEach(function(idx) {
        indexes.push({
          collection: key,
          index: idx.index,
          options: idx.options
        })
      })
    }
    if (config.log > 1) log(indexes)
    async.forEachSeries(indexes, ensureIndex, finish)
    function ensureIndex(item, next) {
      connection[item.collection].ensureIndex(item.index, function(err, indexName) {
        return next(err, indexName)
      })
    }
    function finish(err) {
      if (err) return callback(err)
      ensureAdminUser()
    }
  }

  // Ensure that the admin user exists in the database
  function ensureAdminUser() {
    var users = connection.users

    log('Ensuring admin user')
    users.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
      if (err) return finish(err)
      if (adminUser) return finish(null, adminUser)
      else {
        var newAdminUser = Object.create(util.adminUser)
        newAdminUser.password = users.hashPassword('admin')
        // Insert the admin user bypassing schema validation
        users.insert(newAdminUser, {safe: true, skipValidation: true}, function(err) {
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

    function finish(err, adminUser) {
      if (err) callback(err)
      process.exit(0)
      callback(null, connection)
    }
  }
}
