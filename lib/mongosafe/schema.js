/**
 * Create and initialize schemas understood by mongosafe
 */

var tipe = require('tipe')
var chk = require('chk')
var scrub = require('scrub')
var async = require('async')


function config(options) { return }


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

  return mongo
}


function createSchema(schema1, schema2) {  // can include more

  var functionArray = {type: 'array', value: {type: 'function'}}

  var _schema = {
    id:         { type: 'string' },
    name:       { type: 'string' },
    collection: { type: 'string' },
    fields:     { type: 'object' },
    refs:       { type: 'object' },
    indexes:    { type: 'array' },
    validators: {
      init:   functionArray,
      all:    functionArray,
      insert: functionArray,
      update: functionArray,
      remove: functionArray,
    },
    after:      {
      insert: { type: 'function' },
      update: { type: 'function' },
      remove: { type: 'function' },
    },
    methods:    { type: 'object' },
  }

  // Default empty schema
  var newSchema = {
    id: '',
    name: '',
    collection: '',
    fields: {},
    refs: {},
    indexes: [],
    system: false,
    ownerAccess: false,
    validators: {},
    after: {},
    methods: {},
  }

  var schemas = Array.prototype.slice.call(arguments)

  // Validate the schemas
  var err
  schemas.forEach(function(schema) {
    err = scrub(schema, _schema)
    if (err) return  // forEach
  })
  if (err) return err

  // Merge them
  schemas.forEach(function(schema) {
    merge(newSchema, schema)
  })

  // Create the refs map.  Shouldn't merge do this?
  var fields = newSchema.fields
  for (var field in fields) {
    if (fields[field].ref) newSchema.refs[field] = fields[field].ref
  }


  // Add a convenience method to the schema to be overridden by
  // each schema's objectId factory
  /*
  newSchema.methods.genId = function() {
    return new mongo.ObjectID()
  }
  */

  return newSchema

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
function initSchema(schema, cb) {

  var db = this

  if (!tipe.isFunction(cb)) cb = console.log

  if (!(schema && schema.name)) return cb(new Error('Missing required schema.name'))
  if (!schema.id) return cb(new Error('Missing required schema.id'))
  if (!schema.collection) schema.collection = schema.name

  var collection = db.collection(schema.collection)

  if (!schema.indexes) return finish()

  // Ensure the indexes serially
  async.forEachSeries(schema.indexes, ensureIndex, finish)
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
exports.config = config
