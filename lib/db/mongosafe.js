/**
 * Extend mongodb native to provide validation hooks
 */

var util = require('util')
var log = util.log
var typeOf = require('util').typeOf
var assert = require('assert')
var async = require('async')
var mongo = require('mongodb')
var Collection = mongo.Collection
var Db = mongo.Db


// Extend native mongo methods on require
;(function() {

  // Return the cached collection including the schema and bound schema methods
  Db.prototype._collection = Db.prototype.collection
  Db.prototype.collection = function(collectionName, options, callback) {
    if (!this[collectionName]) {
      return this._collection(collectionName, options, callback)
    }
    if (options || callback) {
      throw new Error('Invalid call to mongosafe Db.collection: ' +
          'options and callbacks are not supported')
    }
    return this[collectionName]
  }

  // Add our safe methods to mongodb.Collections
  Collection.prototype.safeInsert = function(docs, options, callback) {

    assert(typeOf(docs) === 'object' || typeOf(docs) === 'array', 'Invalid param docs')
    assert(typeOf(options) === 'object', 'Invalid param options')
    assert(typeOf(callback) === 'function' || typeOf(callback) === 'undefined', 'Invalid param callback')

    var doc = docs
    callback = callback || log

    if (docs instanceof Array) {
      if (docs.length === 1) doc = docs[0] // single-element array is ok
      else throw new Error('safeInsert does not accept multi-value arrays')
    }

    setDefaults(doc, this.schema)
    validateAndRun(this, 'insert', null, doc, options, callback)
  }

  Collection.prototype.safeUpdate = function(doc, options, callback) {

    assert(typeOf(doc) === 'object', 'Invalid param doc')
    assert(typeOf(doc._id) === 'string', 'Invalid param doc._id')
    assert(typeOf(options) === 'object', 'Invalid param options')
    assert(typeOf(callback) === 'function' || typeOf(callback) === 'undefined', 'Invalid param callback')
    callback = callback || log

    if (options.upsert || options.multi) {
      throw new Error('safeUpdate does not support multi or upsert')
    }
    var query = {_id: doc._id}
    delete doc._id
    validateAndRun(this, 'update', query, doc, options, callback)
  }

  Collection.prototype.safeRemove = function(query, options, callback) {

    assert(typeOf(query) === 'object', 'Invalid param doc')
    assert(typeOf(options) === 'object', 'Invalid param options')
    assert(typeOf(callback) === 'function' || typeOf(callback) === 'undefined', 'Invalid param callback')
    callback = callback || log

    validateAndRun(this, 'remove', query, null, options, callback)
  }

})() // Runs on module load


// Export schema factory
exports.createSchema = function(schema1, schema2) {

  var schema = {
    name: '',
    id: 0,
    fields: {},
    refs: {},
    indexes: [],
    validators: {
      all: [],
      insert: [],
      update: [],
      remove: []
    },
    methods: {}
  }

  /*
   * Recursively merge schema2 into schema1, leaving schema2 unaffected.
   * Arrays are concatentated, simple values are replaced.
   * Requires a typeOf function that distinuished between arrays and objects.
   * Will blow the stack on circular references.
   */
  function merge(s1, s2) {
    for (var key in s2) {
      if (s1 && s1[key] && (typeOf(s2[key]) !== typeOf(s1[key]))) {
        throw new Error('Invalid schema type: ' + key)
      }
      if (typeOf(s1) !== 'object') s1 = {}
      if (typeOf(s2[key]) === 'object') {
        s1[key] = merge(s1[key], s2[key])
      }
      else {
        if (typeOf(s1[key]) === 'array' && typeOf(s2[key]) === 'array') {
          s1[key] = s1[key].concat(s2[key])
        }
        else s1[key] = s2[key]
      }
    }
    return s1
  }

  merge(schema, schema1)
  merge(schema, schema2)

  // Create the refs map
  var fields = schema.fields
  for (var field in fields) {
    if (fields[field].ref) schema.refs[field] = fields[field].ref
  }
  return schema
}


// Initialize the schema
exports.initSchema = function(db, schema, callback) {

  assert(db && db.db, 'Invalid db')
  assert(schema && schema.name, 'schema.name is required')

  var collection = db.collection(schema.name)
  if (util.isError(collection)) return callback(collection)

  // Ensure the indexes serially
  async.forEachSeries(schema.indexes, ensureIndex, finish)
  function ensureIndex(idx, next) {
    collection.ensureIndex(idx.index, idx.options, next)
  }

  // Bind the schema methods to the collection and the collection to mongodb
  function finish(err) {
    if (err) return callback(err)
    // bind schema methods to collection
    for (var name in schema.methods) {
      collection[name] = schema.methods[name]
    }
    if (!db.schemas) db.schemas = {}
    db.schemas[schema.name] = collection.schema = schema
    db[schema.name] = collection
    var c2 = db.collection(collection.collectionName)
    callback(null, schema)
  }
}


// Call the validator methods registerd on the collection
function validateAndRun(collection, method, query, doc, options, callback) {

  var validators = collection.schema.validators
  if (!validators) return executeMongoCommand(null, doc)

  options.collectionName = collection.collectionName

  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    collection.findOne(query, function(err, found) {
      if (err) return callback(err)
      if (!found) return callback(null)
      previous = found
      validate()
    })
  }
  else validate()


  // Run the validators, first the all then the method-specific
  function validate() {
    async.forEachSeries(validators['all'], callValidator, callMethodValidators)

    function callMethodValidators(err) {
      if (err) return callback(err)
      async.forEachSeries(validators[method], callValidator, executeMongoCommand)
    }

    function callValidator(validator, next) {
      validator(doc, previous, options, next)
    }
  }

  // Execute the base mongo call
  function executeMongoCommand(err) {
    if (err) return callback(err)
    scrubOptions(options)
    switch(method) {
      case 'insert':
        var err = checkFields(doc, collection.schema)
        if (err) return callback(err)
        var err = checkRequired(doc, collection.schema)
        if (err) return callback(err)
        return collection.insert(doc, options, handleInserts)
        break
      case 'update':
        var err = checkFields(doc, collection.schema)
        if (err) return callback(err)
        doc = prepareUpdate(doc, previous)
        return collection.update(query, doc, options, handleUpdates)
        break
      case 'remove':
        return collection.remove(query, options, callback)
        break
      default:
        return callback(new Error('Invalid method'))
    }
  }

  // Extract the inserted row from the returned array and return it as a singleton
  function handleInserts(err, docs) {
    if (err) return callback(err)
    callback(err, docs[0])
  }

  // Select the updated row and return it
  function handleUpdates(err, count) {
    if (err) return callback(err)
    // collection.findOne(query, callback)
    collection.findOne(query, function(err, doc) {
      if (err) return callback(err)
      callback(null, doc) 
    })
  }
}

// Remove local options
function scrubOptions(options) {
  delete options.collectionName
}

// Set defaults
// TODO: handle nested schemas
function setDefaults(doc, schema) {
  var fields = schema.fields
  for (var key in fields) {
    if (fields[key].default && !doc[key]) doc[key] = fields[key].default
  }
}

// Check Required
function checkRequired(doc, schema) {
  var fields = schema.fields
  for (var key in fields) {
    if (fields[key].required && !doc[key]) return proxErr.missingParam(key)
  }
}

// Check fields
// TODO: handle nested schemas
function checkFields(doc, schema) {
  var fields = schema.fields
  // Ensure caller did not add new top-level fields
  for (var key in doc) {
    if (!fields[key]) return proxErr.badParam(key)
  }
  // TODO: cast types!
  return null
}

// Delete fields that match those in previous and wrap the update in a $set
// TODO:  sould we do a deep compare on arrays and objects?
function prepareUpdate(doc, previous) {
  for (var key in previous) {
    if (previous[key] == doc[key]) delete doc[key]  // coersio
  }
  doc = {$set: doc}
  return doc
}

