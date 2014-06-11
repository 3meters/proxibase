/**
 * Extend mongodb native to provide validation hooks
 *   for read, insert, update, and remove
 *
 */

var async = require('async')
var util = require('proxutils')   // jshint ignore:line
var scrub = require('scrub')      // jshint ignore:line
var tipe = require('tipe')        // jshint ignore:line
var isObject = tipe.isObject
var isNull = tipe.isNull
var isString = tipe.isString
// var validatorTimeout = 10000


// Extend mongo's Collection
function extend(mongo) {

  var proto = mongo.Collection.prototype

  proto.check = check
  proto.safeInsert = safeInsert
  proto.safeUpdate = safeUpdate
  proto.safeUpsert = safeUpsert
  proto.safeRemove = safeRemove

  return mongo
}


// Check the data in a document againsts its current schema
function check(doc, options) {
  return scrub(doc, this.schema.fields, options)
}


// Insert
function safeInsert(doc, options, cb) {        // jshint ignore:line
  var args = checkArgs(arguments)
  if (tipe.isError(args)) return logErr(args)
  safeExec(this, 'insert', null, args.doc, args.options, args.cb)
}


// Update
function safeUpdate(doc, options, cb) {        // jshint ignore:line
  var args = checkArgs(arguments)
  if (tipe.isError(args)) return logErr(args)
  safeExec(this, 'update', {_id: doc._id}, args.doc, args.options, args.cb)
}


// Upsert
function safeUpsert(doc, options, cb) {        // jshint ignore:line
  var args = checkArgs(arguments)
  if (tipe.isError(args)) return logErr(args)
  var self = this
  if (!doc._id) return safeInsert.call(self, args.doc, args.options, args.cb)
  self.findOne({_id: doc._id}, function(err, foundDoc) {
    if (err) return args.cb(err)
    if (foundDoc) {
      return safeUpdate.call(self, args.doc, args.options, args.cb)
    }
    else return safeInsert.call(self, args.doc, args.options, args.cb)
  })
}


// Remove
function safeRemove(doc, options, cb) {        // jshint ignore:line
  var query = util.clone(doc)
  var args = checkArgs(arguments)
  if (tipe.isError(args)) return logErr(args)
  safeExec(this, 'remove', query, args.doc, args.options, args.cb)
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
function checkArgs(inArgs, idRequired) {
  var args = {
    doc: util.clone(inArgs[0]),
    options: util.clone(inArgs[1]),
    cb: inArgs[2],
  }

  // Args spec
  var spec = {
    doc: {type: 'object', required: true},
    options: {type: 'object', required: true, validate: function(v) {
      if (v.upsert) return 'upsert not supported, use safeUpsert'
      if (v.multi) return 'multi not supported'
    }},
    cb: {type: 'function', default: function(v) {
      console.log(util.inspect(v, true, 20))
    }}
  }

  var err = scrub(args, spec)
  if (err) return err
  if (idRequired && !isString(args.doc._id)) {
    return perr.missingParam('document._id')
  }
  return args

}


// Call the validator methods registerd on the collection
function safeExec(collection, method, query, doc, options, cb) {

  var schema = collection.schema
  options.method = method

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


  // Run the validators, first the init, then the write, then the method-specific
  function validate() {

    async.eachSeries(validators.init, callValidator, callWriteValidators)

    function callWriteValidators(err) {
      if (err) return cb(err)
      async.eachSeries(validators.write, callValidator, callMethodValidators)
    }

    function callMethodValidators(err) {
      if (err) return cb(err)
      async.eachSeries(validators[method], callValidator, executeMongoCommand)
    }
  }

  function callValidator(validator, next) {
    // TODO: wrap in process.nextTick?
    validator.call(collection, doc, previous, options, next)
    /*
    // TODO:  timeout validators that don't call back
    // Otherwise we hang with no clue where
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
  function handleUpdates(err) {
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
function prepareInsert(inDoc, schema) {
  var key, doc = util.clone(inDoc)
  if (tipe.isError(doc)) return doc

  for (key in doc) {
    if (isNull(doc[key])) {
      delete doc[key]
    }
  }
  for (key in doc) {
    if (isObject(doc[key])) {
      var subObj = doc[key]
      for (var subKey in subObj) {
        if (isNull(subObj[subKey])) {
          delete subObj[subKey]
        }
      }
    }
  }
  var err = scrub(doc, schema.fields, {strict: true})
  if (err) return err
  else return doc
}


// Delete fields that match those in previous, $unset values set to null,
// and wrap the update in a $set
function prepareUpdate(inDoc, previous, schema) {

  var key, doc = util.clone(inDoc)
  if (tipe.isError(doc)) return doc

  var unset = {}

  // Add values explicitly set to null to the unset map
  for (key in doc) {
    if (isNull(doc[key])) {
      delete doc[key]
      unset[key] = true
    }
  }

  // Remove dupes from doc
  for (key in previous) {
    var docType = tipe(doc[key])
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

  var err = scrub(doc, schema.fields, options)
  if (err) return err


  // Specify top-level properties of nested objects directly so that
  // unspecified properties in the previous sub-object are not blown away
  for (key in doc) {
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
