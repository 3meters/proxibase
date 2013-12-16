/**
 * Extend mongodb native to provide validation hooks
 *   for insert, update, and remove
 *
 *   BUG: TODO:  errors in the prepare functions, and possibly others,
 *   are swallowed by the driver and emitted on some error event.
 *   Need to find out how to attach a listener and pass back to
 *   the caller
 */

var async = require('async')
var util = require('proxutils')
var chk = require('chk')
var tipe = require('tipe')
var isObject = tipe.isObject
var isNull = tipe.isNull
var isString = tipe.isString
var validatorTimeout = 10000

function config(options) { return }

function extend(mongo) {

  var Db = mongo.Db
  var Collection = mongo.Collection

  Collection.prototype.check =
  function(doc, options) {
    return chk(doc, this.schema.fields, options)
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
    var self = this
    if (!doc._id) return safeInsert.call(self, doc, options, cb)
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
    var query = util.clone(doc)  // remove can operate on multiple docs
    var err = checkArgs(arguments)
    if (err) return cb(err)
    safeExec(this, 'remove', query, doc, options, cb)
  }

  return mongo
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

  if (!tipe.isObject(args[0])) {
    return perr.badType('document must an object', args[0])
  }

  if (!tipe.isObject(args[1])) {
    return perr.badType('options must be an object', args[1])
  }

  // create safe copies of document and options
  args[0] = util.clone(args[0])
  args[1] = util.clone(args[1])

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

  var err = chk(args, _args)
  if (err) return err
  if (idRequired && !isString(args[0]._id)) {
    return perr.missingParam('document._id')
  }
  return null
}


// Call the validator methods registerd on the collection
function safeExec(collection, method, query, doc, options, cb) {

  var schema = collection.schema
  options.method = method

  if (!tipe.isFunction(cb)) cb = console.log

  var validators = schema.validators
  if (!validators) return executeMongoCommand(null, doc)


  // Find the first document in the database matching the query
  var previous = null
  if (query && 'insert' !== method) {
    collection.findOne(query, function(err, found) {
      if (err) return cb(err)
      if (!found) {
        return ('remove' === method)
          ? cb(null, 0)
          : cb(null, null, 0)
      }
      previous = found
      validate()
    })
  }
  else validate()


  // Run the validators, first the init, then the all, then the method-specific
  function validate() {

    async.forEachSeries(validators.init || [], callValidator, callAllValidators)

    function callAllValidators(err) {
      if (err) return cb(err)
      async.forEachSeries(validators.all || [], callValidator, callMethodValidators)
    }

    function callMethodValidators(err) {
      if (err) return cb(err)
      async.forEachSeries(validators[method] || [], callValidator, executeMongoCommand)
    }
  }

  function callValidator(validator, next) {
    if (!tipe.isFunction(validator)) {
      return next(perr.systemError('Invalid validator. Not a function.'))
    }
    validator.call(collection, doc, previous, options, next)
    /*
    // Experimental:  timeout validators that don't call back
    // Otherwise we hang with no clue where
    var finished = false
    setTimeout(function() {
      if (!finished) return next(perr.timeout('Validator'))
    }, validatorTimeout)
    validator.call(collection, doc, previous, options, function() {
      finished = true
      next.apply(collection, arguments)
    })
    */
  }


  // Execute the base mongo call
  function executeMongoCommand(err) {

    if (err) return cb(err)

    switch(method) {

      case 'insert':
        doc = prepareInsert(doc, schema)
        if (tipe.isError(doc)) return cb(doc)
        return collection.insert(doc, options, handleInserts)
        break

      case 'update':
        doc = prepareUpdate(doc, previous, schema)
        if (tipe.isError(doc)) return cb(doc)
        return collection.update(query, doc, options, handleUpdates)
        break

      case 'remove':
        return collection.remove(query, options, handleRemoves)
        break

      default:
        return cb(new Error('Invalid method'))
    }
  }


  // Extract the inserted row from the returned array and return as a singleton
  function handleInserts(err, docs) {
    return (docs)
      ? finish(err, docs[0], 1)
      : finish(err, null, 0)
  }


  // Select the updated row and return it
  function handleUpdates(err, count) {
    if (err) return finish(err, null, 0)
    collection.findOne(query, function(err, savedDoc) {
      return (savedDoc)
        ? finish(err, savedDoc, 1)
        : finish(err, null, 0)
    })
  }


  // Return null as the saved doc
  function handleRemoves(err, count) {
    finish(err, null, count)    // included deleted doc for post-porcessing?
  }


  // Call the callback directly or the after function if it exists
  // The callback signiture for insert and update is (err, doc, count)
  // for remove it is (err, count)
  function finish(err, savedDoc, count) {
    if (!schema.after[method]) {
      return ('remove' === method)
        ? cb(err, count)
        : cb(err, savedDoc, count)
    }
    else {
      var state = {
        method: method,
        document: savedDoc,
        previous: previous,
        options: options,
        count: count,
      }
      if ('remove' === method) state.document = doc  // the orginal doc that has since been deleted
      schema.after[method].call(collection, err, state, cb)
    }
  }
}


// Helpers


// Do not pass through nulls on insert, primarily for symetry with
// update.
function prepareInsert(doc, schema) {
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
  var err = chk(doc, schema.fields, {strict: true})
  if (err) return err
  else return doc
}


// Delete fields that match those in previous, $unset values set to null,
// and wrap the update in a $set
function prepareUpdate(doc, previous, schema) {

  var unset = {}

  // Add values explicitly set to null to the unset map
  for (var key in doc) {
    if (isNull(doc[key])) {
      delete doc[key]
      unset[key] = true
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

  // Validate the doc against the schema using update semantics
  var options = {
    strict: true,
    ignoreRequired: true,
    ignoreDefaults: true,
  }
  var err = chk(doc, schema.fields, options)
  if (err) return err


  // Specify top-level properties of nested objects directly so that
  // unspecified properties in the previous sub-object are not blown away
  for (var key in doc) {
    if (isObject(doc[key]) && isObject(previous[key])) {
      var subDoc = doc[key]
      for (var subKey in subDoc) {
        var propName = key + '.' + subKey
        if (isNull(subDoc[subKey])) {
          unset[propName] = true
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
  return {$set: doc, $unset: unset}
}

exports.extend = extend
exports.config = config
