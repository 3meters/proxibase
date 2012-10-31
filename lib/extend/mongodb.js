/*
 * Extend mongodb native to provide validation hooks
 */

var assert = require('assert')
  , async = require('async')
  , mongodb = require('mongodb')
  , Collection = mongodb.Collection.prototype


// Stash the original methods
Collection._insert = Collection.insert
Collection._update = Collection.update
Collection._save = Collection.save
Collection._remove = Collection.remove
Collection._findAndModify = Collection._findAndModify

// Override the mongo methods that write the database
Collection.insert = function(docs, options, callback) {
  // Works:  Collection._insert.call(this, docs, options, callback)
  validateAndRun(this, 'insert', docs, options, callback)
}

Collection.update = function(docs, options, callback) {
  validateAndRun(this, 'update', docs, options, callback)
}

Collection.save = function(docs, options, callback) {
  validateAndRun(this, 'save', docs, options, callback)
}

Collection.remove = function(docs, options, callback) {
  validateAndRun(this, 'remove', docs, options, callback)
}

Collection.findAndUpdate = function(docs, options, callback) {
  validateAndRun(this, 'findAndUpdate', docs, options, callback)
}

// Call the appropriate validator methods if they have been registerd on the collection
function validateAndRun(collection, method, docs, options, callback) {

  assert(collection && method && docs && options && typeof options === 'object',
      'Invalid call to validate')

  if (options.skipValidation) return execute(null, docs)
  if (!this.validators) return execute(null, docs)

  var validators = []
  addValidators('all')

  switch (method) {
    case 'insert':
      addValidators('save')
      addValidators('insert')
      break
    case 'update':
      addValidators('save')
      addValidators('update')
      break
    case 'save':
      addValidators('save')
      break
    case 'remove':
      addValidators('remove')
      break
    case 'findAndModify':
      addValidators('save')
      break
    default:
      throw new Error('Invalid method')
  }

  function addValidators(method) {
    if (this.validators[method] instanceof Array) {
      validators = validators.concat(this.validators[method])
    }
  }

  // Run the all validators
  if (validators.length) {
    validators.forEachAsync(callValidator, execute)
  }
  else execute(null, docs)

  function callValidator(fn, next) {
    fn(docs, options, next)
  }

  // Execute the base mongo call
  function execute(err, docs) {
    if (err) return callback && callback(err) // callback is optional
    Collection['_' + method].call(collection, docs, options, callback)
  }
}
