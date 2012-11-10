/**
 * Extend mongodb native to provide validation hooks
 */

var assert = require('assert')
var async = require('async')
var mongodb = require('mongodb')
var Collection = mongodb.Collection.prototype
var methods = ['insert', 'update', 'remove', 'save', 'findAndModify', 'findAndRemove']

// Export our schema factory
mongodb.createSchema = function(schema1, schema2) {

  var schema = {
    name: '',
    id: 0,
    fields: {},
    indexes: [],
    validators: {
      all: [],
      insert: [],
      update: [],
      remove: []
    },
    methods: {}
  }

  function extend(o1, o2) {
    for (var key in o2) { o1[key] = o2[key] }
  }

  function merge(s1, s2) {
    if (!(s2 && (typeof s2 === 'object'))) return s1
    s1.name = s2.name || s1.name
    s1.id = s2.id || s1.id
    extend(s1.fields, s2.fields)
    if (s2.indexes) s1.indexes = s1.indexes.concat(s2.indexes)
    for (var method in s2.validators) {
      s1.validators[method] = s1.validators[method].concat(s2.validators[method])
    }
    extend(s1.methods, s2.methods)
    return s1
  }

  merge(schema, schema1)
  merge(schema, schema2)
  return schema
}

// Override the native methods, stashing the orginals
methods.forEach(function(method) {
  Collection['_' + method] = Collection[method]
})

Collection.insert = function(docs, options, callback) {
  var doc = docs
  if (docs instanceof Array) {
    if (docs.length === 1) doc = docs[0] // single element array is ok
    else {
      if (options && options.skipValidation) {
        return Collection._insert(docs, options, callback)
      }
      else {
        callback = callback || console.error
        return callback(new Error('Inserting arrays does not support validation, ' + 
            'insert items one-at-a-time or set skipValidation to true'))
      }
    }
  }
  validateAndRun(this, 'insert', null, doc, options, callback)
}

Collection.update = function(query, update, options, callback) {
  if (options && (options.upsert || options.multi)) {
    if (options.skipValidation) {
      return Collection._update(query, update, options, callback)
    }
    else {
      callback = callback || console.error
      return callback(new Error('update with multi or upsert does not support ' +
          'validation, either turn those options off or turn on skipValidation'))
    }
  }
  validateAndRun(this, 'update', query, update, options, callback)
}

Collection.remove = function(query, options, callback) {
  validateAndRun(this, 'remove', query, null, options, callback)
}

// We don't support the following methods. Make sure the user
// explicitly turns off validation before using them
Collection.save = function(doc, options, callback) {
  if (options && options.skipValidation) {
    scrubOptions(options)
    return Collection._save(doc, options, callback)
  }
  else {
    callback = callback || console.error
    return callback(new Error('save does not support validation, ' +
        'use insert or update, or set skipValidation option to true'))
  }
}

Collection.findAndModify = function(query, sort, update, options, callback) {
  if (options && options.skipValidation) {
    scrubOptions(options)
    return Collection._findAndModify(query, sort, update, options, callback)
  }
  else {
    callback = callback || console.error
    callback(new Error('findAndModify does not support validation, ' +
        'use insert or update, or set skipValidation option to true'))
  }
}

Collection.findAndRemove = function(query, sort, options, callback) {
  if (options && options.skipValidation) {
    scrubOptions(options)
    return Collection._findAndRemove(query, sort, options, callback)
  }
  else {
    callback = callback || console.error
    callback(new Error('findAndRemove does not support validation, ' +
        'use remove, or set skipValidation to option to true'))
  }
}


// Call the validator methods registerd on the collection
function validateAndRun(collection, method, query, docs, options, callback) {

  // Skip if told to or no validators present
  if (options.skipValidation) return executeMongoCommand(null, docs)
  if (!this.validators) return executeMongoCommand(null, docs)

  var errorCb = callback || console.error
  options.collectionName = collection.collectionName

  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    collection.findOne(query, options, function(err, found) {
      if (err) return errorCb(err)
      if (found.length) previous = found[0]
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
  function executeMongoCommand(err, docs) {
    if (err) return errorCb(err)
    scrubOptions(options)
    switch(method) {
      case 'insert':
        return Collection._insert.call(collection, docs, options, callback)
        break
      case 'update':
        return Collection._update.call(collection, query, docs, options, handleUpdates)
        break
      case 'remove':
        return Collection._remove.call(collection, query, options, callback)
        break
      default:
        return errorCb(new Error('Invalid method'))
    }
  }

  // Select the updated rows and return them
  function handleUpdates(err, count) {
    if (err) return errorCb(err)
    return Collection.find.call(collection, query, callback)
  }

}

// Remove local options
function scrubOptions(options) {
  delete options.skipValidation
  delete options.cName
}
