/**
 * Create and initialize schemas understood by mongosafe
 */

var tipe = require('tipe')        // jshint ignore:line
var scrub = require('scrub')      // jshint ignore:line
var async = require('async')      // jshint ignore:line
var fs = require('fs')
var path = require('path')


function extend(mongo) {

  // Export the db init function
  mongo.initDb = initDb

  // Export schema factory
  mongo.createSchema = createSchema

  var Db = mongo.Db

  // Override the collection method to return our annotated version
  var _collection = Db.prototype.collection
  Db.prototype.collection = function(collectionName) {
    if (this.safeCollections && this.safeCollections[collectionName]) {
      return this.safeCollections[collectionName]
    }
    else {
      return _collection.apply(this, arguments) // passthrough
    }
  }

  // Getter for a safeSchema by name
  Db.prototype.safeSchema = function(schemaName) {
    return (this.safeSchemas && this.safeSchemas[schemaName])
      ? this.safeSchemas[schemaName]
      : null
  }

  // Getter for a safeCollection by name
  Db.prototype.safeCollection = function(collectionName) {
    return (this.safeCollections && this.safeCollections[collectionName])
      ? this.safeCollections[collectionName]
      : null
  }

  Db.prototype.initSchema = initSchema

  return mongo
}


/**
 * inititlize the mongo database
 *
 * initDb(config, schemaPath, cb)
 *   Connects to a mongo database
 *   Loads the schemas
 *   Inits the schemas, ensuruing indexes
 *   Returns a mongodb connection object
 *
 * createSchema
 *   Schema constructor
 *
 * schemas
 *  Returns map of all the loaded schemas
 *
 */
function initDb(config, schemaPath, cb) {

  var mongo = this

  if (!tipe.isFunction(cb)) cb = util.logErr

  if (!(config && config.host && config.port && config.database
        && tipe.isString(schemaPath))) {
    return cb(perr.serverError('Invalid call to initDb:\n' +
        'schemaPath: ' + schemaPath + '\n' + 'config:', config))
  }

  // Configure server and database connection options
  var serverOps = _.assign({auto_reconnect: true}, config.serverOps)
  var dbOps = _.assign({w: 1, native_parser: true}, config.dbOps)

  // Create server and db instances
  var server = new mongo.Server(config.host, config.port, serverOps)
  var db = new mongo.Db(config.database, server, dbOps)

  // Open the db connection
  db.open(function(err) {
    if (err) return cb(err)
    loadSchemas(schemaPath, cb)
  })


  // Load the schema files from the specifed directory
  function loadSchemas(dir, cb) {

    var schemas = []

    // Load each schema in the schema directory
    fs.readdirSync(dir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(dir, fileName))
        if (tipe.isFunction(module.getSchema)) {
          var schema = module.getSchema()
          if (tipe.isError(schema)) return cb(schema)
          if (!tipe.isObject(schema)) return cb(perr.serverError('Invalid schema: ' + fileName))
          schemas.push(schema)
        }
      }
    })

    // Sort schemas ascending by id
    schemas.sort(function(a, b) { return a.id - b.id })

    // Init each schema
    async.eachSeries(schemas, initSchema, function(err) {
      if (err) return cb(err)
      cb(null, db)
    })

    function initSchema(schema, nextSchema) {
      db.initSchema(schema, config.ensureIndexes, nextSchema)
    }
  }
}


function createSchema() {  // arguments is an ordered list of schemas

  var err, schema = {}
  var functionArray = {type: 'array', default: [], value: {type: 'function'}}

  var _schema = { type: 'object', required: true, value: {
    id:         { type: 'string' },
    name:       { type: 'string' },
    collection: { type: 'string' },
    fields:     { type: 'object', default: {} },
    indexes:    { type: 'array',  default: [] },
    refs:       { type: 'object', default: {} },
    methods:    { type: 'object', default: {} },
    before:     { type: 'object', default: {}, value: {
      init:   functionArray,
      read:   functionArray,
      write:  functionArray,
      insert: functionArray,
      update: functionArray,
      remove: functionArray,
    }},
    after:      { type: 'object', default: {}, value: {
      read:   { type: 'function'},  // like highlander, there can be only one
      insert: { type: 'function'},
      update: { type: 'function'},
      remove: { type: 'function'},
    }},
  }}

  // Init the base schema
  err = scrub(schema, _schema)
  if (err) return err

  // Process each schema
  var schemas = Array.prototype.slice.call(arguments)
  for (var i = 0; i < schemas.length; i++) {
    err = scrub(schemas[i], _schema)
    if (err) return err
    schema = merge(schema, schemas[i])
    if (tipe.isError(schema)) return schema
  }

  // Create the refs map.  Shouldn't merge do this?
  var fields = schema.fields
  for (var field in fields) {
    if (fields[field].ref) schema.refs[field] = fields[field].ref
  }

  // Ensure that some schema in the chain set the required properties
  err = scrub(schema, {
    id: {required: true},
    name: {required: true},
    collection: {default: function() {return this.name}},
  })
  if (err) return err

  return schema

  //  Helper to recursively merge schema2 into schema1.  Objects are
  //  merged, arrays are concatentated, scalars are replaced.
  //  TODO: replace with lodash _.merge() ?
  function merge(s1, s2) {
    for (var key in s2) {
      if (tipe(s1) !== 'object') s1 = {}
      if (tipe(s2[key]) === 'object') {
        s1[key] = merge(s1[key], s2[key])
      }
      else {
        if (tipe(s1[key]) === 'array' && tipe(s2[key]) === 'array') {
          s1[key] = s1[key].concat(s2[key])
        }
        else s1[key] = s2[key]
      }
    }
    return s1
  }
}


// Initialize the schema
function initSchema(schema, ensureIndexes, cb) {

  // Some component in the create schema chain must set these props or we will fail on init
  var _schemaInstance = {
    id:         { required: true },
    name:       { required: true },
    collection: { required: true },
  }
  var err = scrub(schema, _schemaInstance)
  if (err) return cb(err)

  var db = this

  if (!tipe.isFunction(cb)) cb = util.logErr

  if (!(schema && schema.name)) return cb(new Error('Missing required schema.name\n' + util.inspect(schema)))
  if (!schema.id) return cb(new Error('Missing required schema.id', schema))
  if (!schema.collection) schema.collection = schema.name

  var collection = db.collection(schema.collection)

  if (!schema.indexes) return finish()

  // Ensure the indexes serially
  if (ensureIndexes) {
    async.eachSeries(schema.indexes, ensureIndex, finish)
  }
  else finish()

  function ensureIndex(idx, next) {
    collection.ensureIndex(idx.index, idx.options, next)
  }

  // Bind the schema methods to the collection and the collection to the db object
  function finish(err) {
    if (err) return cb(err)

    // bind schema methods to collection
    for (var name in schema.methods) {
      collection[name] = schema.methods[name].bind(collection)
    }

    db.safeSchemas = db.safeSchemas || {}

    for (var s in db.safeSchemas) {
      if (db.safeSchemas[s].id === schema.id && db.safeSchemas[s].name !== schema.name) {
        return cb(new Error('Conflicting schema.id ' + schema.id))
      }
    }
    collection.schema = schema
    db.safeSchemas[schema.name] = schema

    // Reverse map by collection
    db.safeCollections = db.safeCollections || {}
    db.safeCollections[collection.collectionName] = collection

    // Bind safe collections directly to the db object
    db[schema.collection] = collection
    cb(null, schema)
  }
}

exports.extend = extend
