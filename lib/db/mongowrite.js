/**
 * Extend mongodb native to provide validation hooks
 *   for insert, update, and remove
 */

var util = require('proxutils')
var async = require('async')
var mongo = require('mongodb')
var Db = mongo.Db
var Collection = mongo.Collection
var tipe = util.type
var isObject = tipe.isObject
var isNull = tipe.isNull
var isString = tipe.isString


function extendMongodb() {

  var _collection = Db.prototype.collection

  Db.prototype.collection =
  function(collectionName, options, cb) {
    if (!this[collectionName]) {
      // Not a known schema, pass thorugh to native method
      return _collection.apply(this, arguments)
    }
    return this[collectionName]
  }


  Collection.prototype.check =
  function(doc, options) {
    return util.check(doc, this.schema.fields, options)
  }


  var safeInsert =
  Collection.prototype.safeInsert =
  function(doc, options, cb) {
    var err = checkArgs(arguments)
    if (err) return cb(err)
    safeExec(this, 'insert', null, doc, options, cb)
  }


  var safeUpdate =
  Collection.prototype.safeUpdate =
  function(doc, options, cb) {
    var err = checkArgs(arguments, true)
    if (err) return cb(err)
    safeExec(this, 'update', {_id: doc._id}, doc, options, cb)
  }


  Collection.prototype.safeUpsert =
  function(doc, options, cb) {
    var err = checkArgs(arguments, true)
    if (err) return cb(err)
    var self = this
    self.findOne({_id: doc._id}, function(err, foundDoc) {
      if (err) return cb(err)
      if (foundDoc) {
        return safeUpdate.call(self, foundDoc, options, cb)
      }
      else return safeInsert.call(self, doc, options, cb)
    })
  }


  Collection.prototype.safeRemove =
  function(doc, options, cb) {
    var err = checkArgs(arguments)
    if (err) return cb(err)
    // admins can delete all records in a collection
    var query = doc._id ? {_id: doc._id} : {}
    safeExec(this, 'remove', query, doc, options, cb)
  }

}


/*
 * check arguments
 *
 * @args[0] document object, required
 * @args[1] options object, required
 * @args[2] cb function, optional
 *
 * @idRequired boolean true if doc._id is required, optional
 *
 */
function checkArgs(args, idRequired) {

  var _args = {

    // document
    0: {type: 'object', required: true},

    // options
    1: {type: 'object', required: true, value: function(v) {
        if (v.upsert) return 'upsert not supported, use safeUpsert'
        if (v.multi) return 'multi not supported'
        return null
      }
    },

    // callback
    2: {type: 'function', default: util.noop}
  }

  var err = util.check(args, _args)
  if (err) return err
  if (idRequired && !isString(args[0]._id)) {
    return perr.missingParam('document._id')
  }
  return null
}


// Call the validator methods registerd on the collection
function safeExec(collection, method, query, doc, options, cb) {

  var validators = collection.schema.validators
  if (!validators) return executeMongoCommand(null, doc)


  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    collection.findOne(query, function(err, found) {
      if (err) return cb(err)
      if (!found) return cb(null)
      previous = found
      validate()
    })
  }
  else validate()


  // Run the validators, first the all then the method-specific
  function validate() {
    async.forEachSeries(validators['all'], callValidator, callMethodValidators)

    function callValidator(validator, next) {
      validator.call(collection, doc, previous, options, next)
    }

    function callMethodValidators(err) {
      if (err) return cb(err)
      async.forEachSeries(validators[method], callValidator, executeMongoCommand)
    }
  }


  // Execute the base mongo call
  function executeMongoCommand(err) {

    if (err) return cb(err)

    switch(method) {

      case 'insert':
        var err = util.check(doc, collection.schema.fields, {strict: true})
        if (err) return cb(err)
        doc = prepareInsert(doc)
        return collection.insert(doc, options, handleInserts)
        break

      case 'update':
        var options = {
          strict: true,
          ignoreRequired: true,
          ignoreDefaults: true
        }
        var err = util.check(doc, collection.schema.fields, options)
        if (err) return cb(err)
        doc = prepareUpdate(doc, previous)
        if (doc) return collection.update(query, doc, options, handleUpdates)
        else {log('debug skipping update');return cb(null, previous)} // no-op, return previous record
        break

      case 'remove':
        return collection.remove(query, options, cb)
        break

      default:
        return cb(new Error('Invalid method'))
    }
  }


  // Extract the inserted row from the returned array and return as a singleton
  function handleInserts(err, docs) {
    if (err) {
      // Cast duplicate value MongoError error as a ProxError
      if ('MongoError' === err.name && 11000 === err.code) {
        err = proxErr.noDupes(err.message)
      }
      return cb(err)
    }
    cb(null, docs[0])
  }


  // Select the updated row and return it
  function handleUpdates(err, count) {
    if (err) return cb(err)
    collection.findOne(query, function(err, doc) {
      if (err) return cb(err)
      cb(null, doc)
    })
  }
}


// Do not pass through nulls on insert, primarily for symetry with
// update.
function prepareInsert(doc) {
  for (var key in doc) {
    if (isNull(doc[key])) {
      delete doc[key]
    }
  }
  for (var key in doc) {
    if (isObject(doc[key])) {
      var subObj = doc[key]
      for (var subKey in subObj) {
        if (isNull(subObj[subKey])) {
          delete subObj[subKey]
        }
      }
    }
  }
  return doc
}


// Delete fields that match those in previous, $unset values set to null,
// and wrap the update in a $set
function prepareUpdate(doc, previous) {
  var unSet = {}


  // Add values explicitly set to null to the unSet map
  for (var key in doc) {
    if (isNull(doc[key])) {
      delete doc[key]
      unSet[key] = true
    }
  }


  // Remove dupes from doc
  for (var key in previous) {
    var docType = tipe(doc[key])
    var prevType = tipe(previous[key])
    if (docType !== 'undefined') {
      switch (docType) {
        case 'number':
        case 'string':
        case 'boolean':
          if (previous[key] === doc[key]) delete doc[key]
          break
        case 'object':
          if (docType === 'object'
              && _.isEqual(doc[key], previous[key])) {
            delete doc[key]
          }
          break
      }
    }
  }


  // Specify top-level properties of nested objects directly so that
  // unspecified properties in the previous sub-object are not blown away
  for (var key in doc) {
    if (isObject(doc[key]) && isObject(previous[key])) {
      var subDoc = doc[key]
      for (var subKey in subDoc) {
        var propName = key + '.' + subKey
        if (isNull(subDoc[subKey])) {
          unSet[propName] = true
        }
        else {
          doc[propName] = subDoc[subKey]
        }
      }
      delete doc[key]
    }
  }


  // Put it all together
  delete doc._id
  var updateDoc = {}
  if (!_.isEmpty(doc)) updateDoc.$set = doc
  if (!_.isEmpty(unSet)) updateDoc.$unset = unSet
  if (!_.isEmpty(updateDoc)) return updateDoc
  else return null
}


extendMongodb() // runs on require