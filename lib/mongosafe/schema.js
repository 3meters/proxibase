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

  if (!(tipe.isObject(config) && tipe.isString(schemaPath) && tipe.isFunction(cb))) {
    var err = new Error('Invalid call to mongosafe.initDb. Expected config, schemaPath, cb')
    console.error(err)
    return cb(err)
  }

  var mongo = this

  config = _.assign({timeout: 60000}, config)

  if (!(config.host && config.port && config.database
        && tipe.isString(schemaPath))) {
    return cb(perr.serverError('Invalid call to initDb:\n' +
        'schemaPath: ' + schemaPath + '\n' + 'config:', config))
  }

  // Pass the config object to the submodules
  this.config(config)

  // Configure server and database connection options
  var url = 'mongodb://' + config.host + ':' + config.port + '/' + config.database
  var connectOps = {
    server: _.assign({auto_reconnect: true}, config.serverOps),
    db:     _.assign({w: 1, native_parser: true}, config.dbOps),
  }

  mongo.MongoClient.connect(url, connectOps, function(err, db) {
    if (err) return cb(err)
    loadSchemas(schemaPath, db, cb)
  })

  // Load the schema files from the specifed directory
  function loadSchemas(dir, db, cb) {

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
      db.initSchema(schema, config.skipEnsureIndexes, nextSchema)
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
    documents:  { type: 'array',  default:[] },
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
function initSchema(schema, skipEnsureIndexes, cb) {

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

  if (!schema.indexes) return bindSchema()

  // Ensure the indexes serially
  if (!skipEnsureIndexes) {
    async.eachSeries(schema.indexes, ensureIndex, bindSchema)
  }
  else bindSchema()

  // Call mongodb ensure indexes
  function ensureIndex(idx, next) {
    collection.ensureIndex(idx.index, idx.options, next)
  }


  // Bind the schema methods to the collection and the collection to the db object
  function bindSchema(err) {
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

    // The 1.x mongo driver used to do this, but it was pushed under the s object in 2.x
    collection.db = db

    collection.schema = schema
    db.safeSchemas[schema.name] = schema

    // Reverse map by collection
    db.safeCollections = db.safeCollections || {}
    db.safeCollections[collection.collectionName] = collection

    // Map of safe collection names
    db.safeCollectionNames = db.safeCollectionNames || {}
    db.safeCollectionNames[collection.collectionName] = true

    // Bind safe collections directly to the db object
    db[schema.collection] = collection

    if (!(tipe.isObject(db[schema.collection]) && db[schema.collection].collectionName)) {
      return cb(perr.serverError('Could not bind collection ' + schema.collection + ' to db object'))
    }

    // Add any default data
    if (!skipEnsureIndexes) {
      async.eachSeries(schema.documents, ensureDocument, finish)
    }
    else finish()
  }

  // Specs can describe documents that must ensured to be present, like indexes
  function ensureDocument(doc, next) {
    if (!doc._id) return cb(perr.serverError('Ensure document missing required _id', doc))
    collection.safeFindOne({_id: doc._id}, {asAdmin:true, tag:'ensureDocument.' + doc._id}, function(err, foundDoc) {
      if (err) return cb(err)
      if (foundDoc) {
        log(schema.name + ' ' + foundDoc._id + ' exists')
        return next()
      }

      // Special-case user passwords
      if (collection.collectionName === 'users' && doc.name && !doc.password) {
        doc.password = collection.hashPassword(doc.name)
      }

      // Insert bypassing validators
      collection.insert(doc, {safe: true}, function(err, cSaved) {
        if (err) return cb(err)
        if (!cSaved) return cb(perr.serverError('Ensure document insert failed', doc))
        log(schema.name + ' ' + doc._id + ' created')
        next()
      })
    })
  }

  // Return the completed schema or an error
  function finish(err) {
    cb(err, schema)
  }
}

exports.extend = extend
