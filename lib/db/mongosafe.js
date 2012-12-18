/**
 * Extend mongodb native to provide validation hooks
 */

var util = require('util')
var log = util.log
var typeOf = require('util').typeOf
var assert = require('assert')
var async = require('async')
var mongo = require('mongodb')
var Db = mongo.Db
var Collection = mongo.Collection


// Extend native mongo methods on require
;(function() {

  // Return the bound collection including the schema and bound methods
  var _collection = Db.prototype.collection
  Db.prototype.collection = function(collectionName, options, callback) {
    if (!this[collectionName]) {
      // Not known to us through mongoSchema, pass thorugh to native method
      return _collection.call(this, collectionName, options, callback)
    }
    return this[collectionName]
  }

  Collection.prototype.safeInsert = function(doc, options, callback) {
    checkParams(arguments)
    setDefaults(doc, this.schema)
    validateAndRun(this, 'insert', null, doc, options, callback)
  }

  Collection.prototype.safeUpdate = function(doc, options, callback) {
    checkParams(arguments, true)
    assert(!options.upsert, 'safeUpdate does not support upsert')
    assert(!options.multi, 'safeUpdate does not support multi')
    validateAndRun(this, 'update', {_id: doc._id}, doc, options, callback)
  }

  Collection.prototype.safeUpsert = function(doc, options, callback) {
    checkParams(arguments)
    assert(typeOf(doc._id) === 'string', 'Invalid or missing param doc._id')
  }

  Collection.prototype.safeRemove = function(doc, options, callback) {
    checkParams(arguments)
    var query = doc._id ? {_id: doc._id} : {}  // admins can delete all records in a collection
    validateAndRun(this, 'remove', query, doc, options, callback)
  }

})() // Runs on module load


/*
 * Check params
 *
 * @args[0] object document
 * @args[1] object options
 * @args[2] function callback or undefined
 * @idRequired boolean true if doc._id is required or undefined
 */
function checkParams(args, idRequired) {
  assert(typeOf(args[0]) === 'object', 'Invalid param document')
  assert(typeOf(args[1]) === 'object', 'Invalid param options')
  assert(typeOf(args[2]) === 'function'
      || typeOf(args[2]) === 'undefined', 'Invalid param callback')
  args[2] = args[2] || log
  if (idRequired) {
    assert(typeof args[0]._id ==='string', 'Missing or invalid document._id')
  }
}


// Call the validator methods registerd on the collection
function validateAndRun(collection, method, query, doc, options, callback) {

  var validators = collection.schema.validators
  if (!validators) return executeMongoCommand(null, doc)

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
      validator.call(collection, doc, previous, options, next)
    }
  }

  // Execute the base mongo call
  function executeMongoCommand(err) {
    if (err) return callback(err)
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
    collection.findOne(query, function(err, doc) {
      if (err) return callback(err)
      callback(null, doc)
    })
  }
}


// Set defaults
// TODO: write test
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
// TODO:  sould we do a deep compare on arrays and objects?  Consider entity comments.
function prepareUpdate(doc, previous) {
  for (var key in previous) {
    if (previous[key] == doc[key]) delete doc[key]
  }
  delete doc._id
  return {$set: doc}
}

