/**
 * Extend mongodb native to provide events for running user code
 *   before and after mongodb insert, update, and removes
 *
 */

var async = require('async')
var util = require('proxutils')   // jshint ignore:line
var scrub = require('scrub')      // jshint ignore:line
var tipe = require('tipe')        // jshint ignore:line
var parse = require('./parse')
var isObject = tipe.isObject
var isNull = tipe.isNull
var isDefined = tipe.isDefined
// var beforeTimeout = 10000


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
  if (!this.schema) return new Error('missing schema')
  this.schema.fields = this.schema.fields || {}
  return scrub(doc, this.schema.fields, options)
}


// Insert
function safeInsert(doc, options, cb) {
  var err = parse.args(arguments)
  doc = util.clone(arguments[0])
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)
  run(this, 'insert', doc, null, options, cb)
}


// Update
function safeUpdate(doc, options, cb) {
  var err = parse.args(arguments, {idRequired: true})
  doc = util.clone(arguments[0])
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)
  var collection = this
  collection.findOne({_id: doc._id}, function(err, previous) {
    if (err) return cb(err)
    if (!previous) return cb(null, null, 0)
    run(collection, 'update', doc, previous, options, cb)
  })
}


// Upsert
function safeUpsert(doc, options, cb) {
  var err = parse.args(arguments, {idRequired: true})
  doc = util.clone(arguments[0])
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)
  var collection = this
  collection.findOne({_id: doc._id}, function(err, previous) {
    if (err) return cb(err)
    if (previous) {
      return run(collection, 'update', doc, previous, options, cb)
    }
    else return run(collection, 'insert', doc, null, options, cb)
  })
}


// Remove
function safeRemove(doc, options, cb) {
  var err = parse.args(arguments, {idRequired: true})
  doc = util.clone(arguments[0])
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)
  var collection = this
  collection.findOne({_id: doc._id}, function(err, previous) {
    if (err) return cb(err)
    if (!previous) return cb(null, {count: 0})
    run(collection, 'remove', doc, previous, options, cb)
  })
}


// Run the before methods.  If they succede execute the db command
function run(collection, method, doc, previous, options, cb) {

  var schema = collection.schema
  options.method = method

  var before = schema.before
  if (before) runBefores()
  else execute()

  // Run the befores, first the init, then the write, then the method-specific
  function runBefores() {

    async.eachSeries(before.init, callBefore, callWriteBefores)

    function callWriteBefores(err) {
      if (err) return cb(err)
      async.eachSeries(before.write, callBefore, callMethodBefores)
    }

    function callMethodBefores(err) {
      if (err) return cb(err)
      async.eachSeries(before[method], callBefore, execute)
    }
  }

  // TODO:  timeout befores that don't call back
  // Otherwise we hang with no clue where
  function callBefore(before, next) {
    before.call(collection, doc, previous, options, next)
  }


  // Execute the base mongo call
  function execute(err) {

    if (err) return cb(err)

    switch(method) {

      case 'insert':
        doc = prepareWrite(doc, null, schema)
        if (tipe.isError(doc)) return cb(doc)
        return collection.insert(doc, options, handleInserts)
        break

      case 'update':
        doc = prepareWrite(doc, previous, schema)
        if (tipe.isError(doc)) return cb(doc)
        return collection.update({_id: doc._id}, doc, options, handleUpdates)
        break

      case 'remove':
        return collection.remove({_id: doc._id}, options, handleRemoves)
        break

      default:
        return cb(new Error('Invalid method'))
    }
  }


  // Extract the inserted row from the returned array and return as a singleton
  function handleInserts(err, docs, meta) {
    return (docs)
      ? finish(err, docs[0], meta)
      : finish(err, null, meta)
  }


  // Select the updated row and return it
  function handleUpdates(err, meta) {
    if (err) return finish(err, null, meta)
    collection.findOne({_id: doc._id}, function(err, savedDoc) {
      return (savedDoc)
        ? finish(err, savedDoc, meta)
        : finish(err, null, meta)
    })
  }


  // Return null as the saved doc
  function handleRemoves(err, meta) {
    finish(err, null, meta)
  }


  // Call the callback directly or the after functions if they exist
  // The callback signiture for insert and update is (err, doc, meta)
  // for remove it is (err, meta)
  //
  //  TODO:  convert afters to array
  //
  //
  function finish(err, savedDoc, meta) {

    // Make sure we return meta as an object with a count property
    if (tipe.isNumber(meta)) meta = {count: meta}  // signiture changed from mongodb 2.4 to 2.6
    if (!tipe.isObject(meta)) meta = {count: 0}
    if (savedDoc) meta.count = 1

    if (!schema.after[method]) {
      return ('remove' === method)
        ? cb(err, meta)
        : cb(err, savedDoc, meta)
    }
    else {
      var state = {
        method: method,
        document: savedDoc,
        previous: previous,
        options: options,
        meta: meta,
      }
      if ('remove' === method) state.document = doc  // the orginal doc that has since been deleted
      schema.after[method].call(collection, err, state, cb)
    }
  }
}


// Helpers


// Do not pass through nulls on insert, primarily for symetry with update.
function prepareWrite(doc, previous, schema) {

  var key
  var orderedDoc = {}
  var newDoc = previous || {}

  // Prune fields that make be saved in the database, but that are no
  // longer in the current schema.
  for (key in newDoc) {
    if (!schema.fields[key]) delete newDoc[key]
  }

  // Remove nulls and undefined from top level properties
  // and one-level deep properties of objects
  for (key in doc) {
    if (isNull(doc[key])) {
      delete newDoc[key]
      delete doc[key]
    }
    // Mainly for backward compat, remove when client quits setting photo properties
    if (isObject(doc[key])) {
      var subObj = doc[key]
      for (var subKey in subObj) {
        if (isNull(subObj[subKey])) delete subObj[subKey]
      }
    }
  }

  for (key in doc) { newDoc[key] = doc[key] }

  var err = scrub(newDoc, schema.fields, {strict: true})
  if (err) return err

  for (key in schema.fields) {
    if (isDefined(newDoc[key])) orderedDoc[key] = newDoc[key]
  }

  return orderedDoc
}


exports.extend = extend
