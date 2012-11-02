/*
 * db/index.js
 *
 *   Connect to a mongo database
 *   Load the schemas
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

    schemaDir = path.join(__dirname, 'schemas')
    var base = require(path.join(schemaDir, '_base'))
    connection.cNames = {}
    connection.collections = {}

    // load each schema by inspecting all js files looking for a public getSchema() method
    fs.readdirSync(schemaDir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(schemaDir, fileName))
        if (module.getSchema) {
          var cName = path.basename(fileName, '.js')
          var schema = merge(base, module.getSchema())
          connection.bind(cName, methods) // mongoskin method
          connection[cName].schema = schema
          connection.cNames[cName] = true
          connection.collections[cName] = connection[cName]
        }
      }
    })

    // Load all references into convenience maps on each schema
    for (var cName in connection.cNames) {
      var schema = connection[cName].schema
      schema.indexes = schema.indexes || {}
      schema.fieldIndexes = {}
      schema.refParents = {}
      schema.refChildren = {}
      var fields = schema.fields
      for (var field in fields) {
        if (field.unique) schema.fieldIndexes[field] = true
        if (field.index) schema.fieldIndexes[field] = false // non-unique
        if (fields[field].ref) {
          if (!connection.cNames[fields[field].ref]) {
            throw new Error('Invalid ref ' + fields[field].ref + ' in schema ' + cName + '.' + field)
          }
          else {
            var parentName = fields[field].ref
            schema.refParents[field] = parentName
            if (!connection.cNames[parentName].schema.refChildren[cName])
              connection.cNames[parentName].schema.refChildren[cName] = []
            connection.cNames[parentName].schema.refChildren[cName].push(field)
          }
        }
      }
      // If there are any conflicts between the field and explict
      // indexes we want the explicit indexes to win
      util.extend(schema.fieldIndexes, schema.indexes)
      schema.indexes = schema.fieldIndexes
    }
    log('Loaded schemas')
    if (config && config.log > 1) logRefs(db)
    // logRefs()  // tmp
    ensureIndexes()
  }

  function merge(schema, ext) {
    var extVals = ext.validators
    delete ext.validators
    utils.extend(schema, ext)
    var valTemplate = {
      all: [],
      insert: [],
      update: [],
      remove: []
    }
    schema.validators = schema.validators || {}
    schema.all = val.all || []
    val.input = val.input || []
    val.m = val.input || []
    val.input = val.input || []
  }

  // Dump all model references to the console
  function logRefs() {
    log('Schema references')
    for (var cName in connection.cNames) {
      log(cName + ' parents', connection.cNames[cName].schema.refParents)
      log(cName + ' children', connection.cNames[cName].schema.refChildren)
    }
  }

  // Ensure all indexes in an asyncronous series
  function ensureIndexes() {
    // build a single array of all indexes to create for all collections
    var indexes = []
    for (var cName in connection.cNames) {
      var schema = connection.cNames[cName].schema
      for (var index in schema.indexes) {
        indexes.push({collection: cName, index: schema.indexes[index]})
      }
    }
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
      callback(null, connection)
    }
  }
}
