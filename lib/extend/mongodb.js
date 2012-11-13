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
var Db = mongo.SkinDb

// Export our schema factory
mongo.createSchema = function(schema1, schema2) {

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
Db.prototype.initSchema = function(schema, callback) {

  assert(schema && schema.name, 'Schema.name is required')
  var self = this

  var collection = this.collection(schema.name)
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
    if (!self.schemas) self.schemas = {}
    self.schemas[schema.name] = collection.schema = schema
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

  if (!this.validators) return executeMongoCommand(null, doc)

  var errorCb = callback || console.error
  options.collectionName = collection.collectionName

  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    collection.find(query, options, function(err, found) {
      if (err) return errorCb(err)
      if (found.length > 1) {
        return errorCb(proxErr.badRequest('Safe requests can only affect one record at a time.'))
      }
      if (found.length === 1) previous = found[0]
      validate()
    })
  }
  else validate()


  // Run the validators, first the all then the method-specific
  function validate() {
    async.forEachSeries(this.validators['all'], callValidator, callMethodValidators)

    function callMethodValidators(err) {
      if (err) return errorCb(err)
      async.forEachSeries(this.validators[method], callValidator, executeMongoCommand)
    }

    function callValidator(validator, next) {
      validator(doc, previous, options, next)
    }
  }

  // Execute the base mongo call
  function executeMongoCommand(err, doc) {
    if (err) return errorCb(err)
    scrubOptions(options)
    switch(method) {
      case 'insert':
        var err = checkFields(doc)
        if (err) return errorCb(err)
        return Collection.prototype.insert.call(collection, doc, options, callback)
        break
      case 'update':
        var err = checkFields(doc)
        if (err) return errorCb(err)
        doc = prepareUpdate(doc)
        // return Collection.prototype.update.call(collection, query, doc, options, handleUpdates)
        return collection.update(query, doc, options, function(err, count) {
          if (err) return errorCb(err)
          return collection.find(query, callback)
        })
        break
      case 'remove':
        return Collection.prototype.remove.call(collection, query, options, callback)
        break
      default:
        return errorCb(new Error('Invalid method'))
    }
  }

  /*
  // Select the updated rows and return them
  function handleUpdates(err, count) {
    if (err) return errorCb(err)
    return Collection.find.call(collection, query, callback)
  }
  */

}

// Remove local options
function scrubOptions(options) {
  delete options.skipValidation
  delete options.cName
}

function checkFields(doc, schema) {
  return null
}

// Make sure the outer operator is $set and delete fields
// that match the previous documents
function prepareUpdate(doc, previous) {
  if (doc.$set && (typeOf($set) === 'object')) doc = doc.$set
  for (key in previous) {
    if (previous[key] === doc[key]) delete doc[key]
  }
  doc = {$set: doc}
  return doc
}

