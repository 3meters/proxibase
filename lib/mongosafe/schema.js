/**
 * Create and initialize schemas understood by mongosafe
 */

var tipe = require('tipe')        // jshint ignore:line
var scrub = require('scrub')      // jshint ignore:line
var async = require('async')      // jshint ignore:line


function extend(mongo) {

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

  Db.prototype.hotSwap = hotSwap

  return mongo
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
      read:   { type: 'function'},
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

  if (!tipe.isFunction(cb)) cb = console.log

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


// Replace a collection with an array
function hotSwap(collectionName, docs, cb) {
  var db = this
  var collection = db.safeCollection(collectionName)
  if (!collection) {
    return cb(new Error('Unknown safe collection: ' + collectionName))
  }
  var schema = collection.schema
  var temp = 'temp_' + collectionName
  db.collection(temp).drop(function(err) {
    if (err) ;  // continue, may not exist
    db.createCollection(temp, function(err) {
      if (err) return cb(err)
      db.collection(temp).insert(docs, {safe: true}, function(err) {
        if (err) return cb(err)
        // temp collection looks ok, drop results and rename temp => results
        db.dropCollection(collectionName, function(err) {
          if (err) ; // continue, may not exist
          db.collection(temp).rename(collectionName, function(err) {
            if (err) return cb(err)
            // rebuild the indexes
            db.initSchema(schema, true, cb)
          })
        })
      })
    })
  })
}

exports.extend = extend
