/**
 * Extend mongodb native to provide events for running user code
 *   before and after mongodb insert, update, and removes
 */


var async = require('async')
var util = require('proxutils')   // jshint ignore:line
var scrub = require('scrub')      // jshint ignore:line
var tipe = require('tipe')        // jshint ignore:line
var parse = require('./parse')
var isObject = tipe.isObject
var isNull = tipe.isNull
var isDefined = tipe.isDefined
var db = global.db || undefined   // jshint ignore:line
var _config


// Set the module global _config object, called by ./schema
function config(options) {
  _config = _.cloneDeep(options)
}


// Extend mongo's Collection
function extend(mongo) {

  var proto = mongo.Collection.prototype

  proto.check = check
  proto.safeInsert = safeInsert
  proto.safeUpdate = safeUpdate
  proto.safeUpsert = safeUpsert
  proto.safeRemove = safeRemove
}


// Spec for inserting a single link
var linkSpec = {type: 'object', value: {
    _to:    {type: 'string'},
    _from:  {type: 'string'},
    type:   {type: 'string', required: true},
  },
  validate: function(link) {
    if (!(link._to || link._from)) return 'link requires either _from or _to'
    if (link._to && link._from) return 'link cannot contain both _from and _to'
  }
}


// Spec for inserting an array of links
var linksSpec = {type: 'array', value: linkSpec}


// Check the data in a document against its current schema
function check(doc, options) {
  if (!this.schema) return new Error('missing schema')
  this.schema.fields = this.schema.fields || {}
  return scrub(doc, this.schema.fields, options)
}


function safeInsert() {
  safeWrite.call(this, 'insert', arguments)
}

function safeUpdate() {
  safeWrite.call(this, 'update', arguments)
}

function safeUpsert() {
  safeWrite.call(this, 'upsert', arguments)
}

function safeRemove() {
  safeWrite.call(this, 'remove', arguments)
}


function safeWrite(cmd, args) {

  var err = parse.args(args, {idRequired: (cmd === 'update' || cmd === 'remove')})
  var docs = _.cloneDeep(args[0])
  var options = args[1]
  var cb = args[2]
  if (err) return cb(err)

  var db = this.db
  var collection = this
  options.method = cmd

  if (cmd === 'insert') {
    // doc links overrides options links
    if (docs.links) {
      options.links = docs.links
      delete docs.links
    }

    if (options.links) {
      err = scrub(options.links, linksSpec)
      if (err) return cb(err)
    }
  }

  safeWriteParsed(db, collection, cmd, docs, options, cb)
}


// Now all the arguments have been parsed and scrubbed
function safeWriteParsed(db, collection, cmd, docs, options, cb) {

  var results = []
  var meta = {}

  // Single object, execute
  if (tipe.isObject(docs)) {
    return writeDoc(cmd, collection, docs, options, cb)
  }

  // Doc is array, process in series
  async.eachSeries(docs, callSafeWrite, finishSafeWrite)

  function callSafeWrite(doc, next) {

    safeWrite.call(collection, cmd, [doc, options, processSavedDoc])

    function processSavedDoc(err, savedDoc, docMeta) {
      if (err) return next(err)
      if (savedDoc) results.push(savedDoc)
      if (docMeta.errors) {
        meta.errors = meta.errors || []
        meta.errors = meta.errors.concat(docMeta.errors)
      }
      next()
    }
  }

  function finishSafeWrite(err) {
    meta.count = results.length
    cb(err, results, meta)
  }
}


// Look up the previous document for non-insert commands.
// Depending on whether it is found, set upserts to insert
// or update. Run the before tasks. If they succede execute
// the db command.
function writeDoc(cmd, collection, doc, options, cb) {

  var previous = null
  var schema = collection.schema

  if (cmd !== 'insert') findPrevious()
  else runBeforeTasks()

  function findPrevious() {

    if (cmd === 'upsert' && !doc._id) {
      cmd = 'insert'
      return runBeforeTasks()
    }

    collection.findOne({_id: doc._id}, function(err, found) {
      if (err) return cb(err)
      if (found) {
        previous = found
        if (cmd === 'upsert') cmd = 'update'
        return runBeforeTasks()
      }
      switch (cmd) {
        case 'upsert':
          cmd = 'insert'
          return runBeforeTasks()
        case 'update':
          return cb(null, null, {count: 0})
        case 'remove':
          return cb(null, {count: 0})
      }
    })
  }

  function runBeforeTasks() {
    var before = schema.before
    if (!before) return execute()

    options.method = cmd

    var tasks = _.compact([].concat(before.init, before.write, before[cmd]))

    async.eachSeries(tasks, runTask, execute)

    // TODO:  timeout before tasks that don't call back
    // Otherwise we hang with no clue where
    function runTask(task, next) {
      task.call(collection, doc, previous, options, next)
    }
  }


  // Execute the base mongo call
  function execute(err) {
    if (err) return cb(err)

    var selector = {_id: doc._id}
    switch(cmd) {

      case 'insert':
        doc = prepareWrite(doc, null, schema)
        if (tipe.isError(doc)) return cb(doc)
        collection.insert(doc, options, shapeResults)
        break

      case 'update':
        doc = prepareWrite(doc, previous, schema)
        if (tipe.isError(doc)) return cb(doc)
        collection.update(selector, doc, options, shapeResults)
        break

      case 'remove':
        collection.remove(selector, options, shapeResults)
        break

      default:
        return cb(perr.serverError('Invalid method: ' + cmd))
    }



    // Ensure all write commands return a common signature.
    // Should work with either mongodb drivers < version 2, which return err, doc, meta,
    // and mongodb drivers >= version 2 which return err, {doc: obj, meta: obj}
    //
    // Mongodb driver 2.x signiture
    // var doc = (result && result.ops && result.ops.length) ? result.ops[0] : null
    function shapeResults(err, dbResults) {
      if (err) return finish(err)

      var savedDoc = null
      var meta = {errors: []}

      switch (cmd) {
        case 'insert':
          if (tipe.isArray(dbResults) && dbResults.length) savedDoc = dbResults[0]
          else if (tipe.isObject(dbResults) && dbResults.ops && dbResults.ops.length) {
            savedDoc = dbResults.ops[0]
          }
          break

        case 'update':
          if (dbResults === 1) {savedDoc = doc}
          else if (tipe.isObject(dbResults) && dbResults.result &&
              dbResults.result.ok && dbResults.result.nModified === 1) {
            savedDoc = doc
          }
          break

        case 'remove':
          if (tipe.isNumber(dbResults)) savedDoc = dbResults
          else if (tipe.isObject(dbResults) && dbResults.result &&
              tipe.isDefined(dbResults.result.n)) {
            savedDoc = dbResults.result.n
          }
          break
      }
      var results = {doc: savedDoc, meta: meta}

      if (results.doc && cmd === 'insert' && options.links) {
        return insertLinks(results, finish)
      }
      return finish(null, results)
    }
  }



  // Newly inserted documents can include an array of links to insert
  // after the document was successfully inserted.
  function insertLinks(results, cb) {

    var doc = results.doc
    var meta = results.meta

    if (!(options.links && options.links.length)) return cb(null, doc, meta)

    var links = []
    var linkDbOps = _.clone(options)
    delete linkDbOps.links

    async.eachSeries(options.links, insertLink, finishInsertLinks)

    // Set which ever side of the link is not specified to doc._id
    function insertLink(link, nextLink) {

      if (link._from) link._to = doc._id
      else (link._from) = doc._id

      collection.db.links.safeInsert(link, linkDbOps, function(err, savedLink, savedLinkMeta) {
        if (err) meta.errors.push({type: 'insertLink', link: link, error: err})
        if (savedLink) links.push(savedLink)
        if (savedLinkMeta) _.merge(meta, savedLinkMeta, function(a, b) {
          if (_.isArray(a)) return a.concat(b)
        })
        nextLink()
      })
    }

    // If any errors were generated add them to meta
    function finishInsertLinks() {
      // Inserting links may have changed the already persisted doc, requery it
      collection.findOne({_id: doc._id}, function(err, savedDoc) {
        if (err) return cb(err)
        savedDoc.links = links
        cb(null, {doc: savedDoc, meta: meta})
      })
    }
  }


  //
  // Call the callback directly or the after functions if they exist
  // The callback signiture for insert and update is (err, doc, meta)
  // for remove it is (err, meta)
  //
  function finish(err, results) {
    if (err) return cb(err)

    var savedDoc = results.doc
    var meta = results.meta

    if (savedDoc) meta.count = 1
    if (!meta.errors.length) delete meta.errors

    if (!schema.after[cmd]) {
      if ('remove' === cmd) return cb(err, meta)
      else return cb(err, savedDoc, meta)
    }
    else {
      var state = {
        method: cmd,
        document: savedDoc,
        previous: previous,
        options: options,
        meta: meta,
      }
      if ('remove' === cmd) state.document = doc  // the orginal doc that has since been deleted
      schema.after[cmd].call(collection, err, state, cb)
    }
  }
}


// Helpers



// Do not pass through nulls on insert, primarily for symetry with update.
function prepareWrite(doc, previous, schema) {

  var key
  var orderedDoc = {}
  var newDoc = _.cloneDeep(previous) || {}

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

  // Store fields in the order defined by the schema. Not reliable in javascript,
  // but easier on the eye
  for (key in schema.fields) {
    if (isDefined(newDoc[key])) orderedDoc[key] = newDoc[key]
  }

  return orderedDoc
}


exports.config = config
exports.extend = extend
