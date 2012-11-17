/**
 * Extend mongodb native to provide validation hooks
 */

var util = require('util')
var log = util.log
var typeOf = require('util').typeOf
var assert = require('assert')
var async = require('async')
var mongo = require('mongoskin')
var Collection = mongo.SkinCollection

// Export our schema factory
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
    callback(null, schema)
  }
}

// Add our safe methods to mongodb.Collections
Collection.prototype.safeInsert = function(docs, options, callback) {
  var doc = docs
  if (docs instanceof Array) {
    if (docs.length === 1) doc = docs[0] // single-element array is ok
    else {
      callback = callback || console.error
      return callback(proxErr.badValue('safeInsert does not accept multi-value arrays'))
    }
  }
  setDefaults(doc, this.schema)
  validateAndRun(this, 'insert', null, doc, options, callback)
}

Collection.prototype.safeUpdate = function(query, update, options, callback) {
  if (options && (options.upsert || options.multi)) {
    callback = callback || console.error
    return callback(proxErr.badParam('safeUpdate does not support multi or upsert'))
  }
  validateAndRun(this, 'update', query, update, options, callback)
}

Collection.prototype.safeRemove = function(query, options, callback) {
  validateAndRun(this, 'remove', query, null, options, callback)
}


// Call the validator methods registerd on the collection
function validateAndRun(collection, method, query, doc, options, callback) {

  callback = callback || console.log
  var validators = collection.schema.validators

  log('Validate and run collectionName', collection.collectionName)
  log('method',  method)
  log('options',  options)


  if (!validators) return executeMongoCommand(null, doc)

  options.collectionName = collection.collectionName

  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    Collection.prototype.findOne.call(collection, query, function(err, found) {
      if (err) return callback(err)
      log('Found previous:', found)
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
    log('exec ' + method + ' on ' + collection.collectionName)
    log('doc:', doc)
    if (err) return callback(err)
    scrubOptions(options)
    switch(method) {
      case 'insert':
        var err = checkFields(doc, collection.schema)
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
    log('handle inserts err', err)
    log('handle inserts docs', docs)
    if (err) return callback(err)
    callback(err, docs[0])
  }

  // Select the updated row and return it
  function handleUpdates(err, count) {
    if (err) return callback(err)
    log('Update count for ' + collection.collectionName + ': ' + count)
    log('query', query)
    collection.findOne(query, callback)
  }
}

// Remove local options
function scrubOptions(options) {
  delete options.collectionName
}

// Set defaults
// TODO: handle nested schemas
function setDefaults(doc, schema) {
  log('setting defaults')
  var fields = schema.fields
  for (var key in fields) {
    if (fields[key].default && !doc[key]) doc[key] = fields[key]
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
  // checkRequired
  for (var key in fields) {
    if (fields[key].required && !doc[key]) return proxErr.missingParam(key)
  }
  // TODO: cast types!
  log('fields are clean')
  return null
}

// Make sure the outer operator is $set and delete fields
// that match the previous documents
function prepareUpdate(doc, previous) {
  log('prepareUpdate')
  log('doc', doc)
  log('previous', previous)
  if (doc.$set && (typeOf($set) === 'object')) doc = doc.$set
  for (key in previous) {
    if (previous[key] === doc[key]) delete doc[key]
  }
  delete doc._id
  doc = {$set: doc}
  log('doc now:', doc)
  return doc
}

