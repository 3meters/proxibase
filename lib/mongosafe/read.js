/**
 * Mongoread: extend mongodb native find
 */

var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var agg = require('./agg')
var getRefs = require('./refs')
var links                     // required below

var _config = {
  limits: {
    default: 50,
    max: 1000,
    join: 1000,
  },
}

// Set config options or return a safe copy
function config(options) {
  if (tipe.isObject(options)) {
    _.merge(_config, options)
  }
  return _.cloneDeep(_config)
}

var fieldSpec = exports.fieldSpec = {
  type: 'object|string|boolean|number',
  strict: false,
  default: {},
  value: parse.arg,
}

var sortSpec = exports.sortSpec = {
  type: 'object|array|string',
  default: function() { return _config.sort },
  value: parse.sort
}

var limitSpec = exports.limitSpec = {
  type: 'number',
  default: function() { return _config.limits.default },
  value: function(v) {
    // 0 means unlimited in in mongo, which we disallow: set to max
    if (v === 0) return _config.limits.max
    // silently reduce, do not error
    return Math.min(v, _config.limits.max)
  }
}


// Links imports from the specs above and exports to the
// specs below.  Must be required here.
links = require('./links')


var safeFindSpec = {
  type: 'object', value: {
    query:          {type: 'object', strict: false},  // mongodb pass-through query clause
    fields:         fieldSpec,
    count:          {type: 'boolean|number'},
    genId:          {type: 'boolean'},
    countBy:        {type: 'array', value: {type: 'string'}},
    sort:           sortSpec,
    skip:           {type: 'number'},
    limit:          limitSpec,
    refs:           {type: 'boolean|string|object|number'}, // TODO: get from refs module
    utc:            {type: 'boolean'},
    links:          links.findLinksSpec,
    linked:         links.findLinkedSpec,
    debug:          {type: 'boolean'},
    user:           {type: 'object', value: {
      _id: {type: 'string', required: true},
      role: {type: 'string', required: true},
    }}
  }, validate: function() {
    if (this.links && this.linked) return 'Cannot specify both links and linked'
  }
}


// Add safeFind methods to mongo Collection constructor
function extend(mongo) {

  var proto = mongo.Collection.prototype

  proto.safeFind = safeFind
  proto.safeFindOne = safeFindOne
  proto.safeFirst = safeFirst
  proto.safeLast = safeLast
  proto.safeEach = safeEach

  // Called by the stats framework
  proto.decorate = function(docs, options, cb) {
    decorate(this, docs, options, cb)
  }

  // Informational method describing safeFind's expected argument signiture
  mongo.Db.prototype.safeFindSpec = getSafeFindSpec

  return mongo
}


// safeFind public method
function safeFind(query, options, cb) {

  var err = parse.args(arguments)
  query = arguments[0]
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)

  var timer = util.timer()

  var collection = this
  var selector = query.query || query || {}

  // Call the schema validators
  validate(collection, query, options, runQuery)

  // Call the database and retrieve the results
  function runQuery(err, query, options) {

    if (err) return cb(err)

    if (tipe.isDefined(options.results)) return processDocs(null, options.results)

    options.originalLimit = options.limit

    // Limit = 1 usually means a cursor walk, leave alone
    if (options.limit > 1) options.limit++

    // Diagnostics
    if (options.debug) {
      log('safeFind query on ' + collection.collectionName + ':', selector)
      log('safeFind options:', options)
    }

    // Generate a valid collection _id
    if (options.genId) {
      var id = collection.genId(query)
      if (tipe.isError(id)) return cb(id)
      else return cb(null, {_id: id})
    }

    // Count
    if (options.count) {
      return collection.find(selector, options)
        .count(function (err, count) {
          if (err) return cb(err)
          cb(null, count)
        })
    }

    // CountBy
    if (options.countBy) {
      return agg.countBy(collection, selector, options, processDocs)
    }

    // Regular Find
    options.method = options.method || 'find'

    if (util.config.db.explain) {
      collection.find(selector, options).explain(function(err, expl) {
        log('Explain: find selector', selector)
        log('Explain:', expl)
      })
    }

    // debug('safeFind', selector)

    collection.find(selector, options).toArray(processDocs)
  }

  // Decorate the results and call back
  function processDocs(err, docs) {
    if (err) return cb(err)

    options.more = false
    if (docs && docs.length > options.originalLimit) {
      docs.pop()
      options.more = true
    }

    // Restore original limit
    if (tipe.isDefined(options.originalLimit)) {
      options.limit = options.originalLimit
      delete options.originalLimit
    }

    // Get links or linked documents
    if (options.links || options.linked) {
      var linkOps = {
        user: options.user,
        asAdmin: options.asAdmin,
        asReader: options.asReader,
        links: options.links,
        linked: options.linked,
        refs: options.refs,
      }
      links.get(collection, docs, linkOps, finish)
    }
    else finish(err, docs)
  }

  // Wrap up
  function finish(err, docs) {

    decorate(collection, docs, options, function(err, docs) {
      if (err) return cb(err)

      options.count = docs.length
      options.skip = options.skip || 0
      options.dbTime = timer.read()

      var after = collection.schema.after.read

      if (!after) return cb(null, docs, options)

      var scope = {
        docs: docs,
        options: options,
      }
      after.call(collection, null, scope, cb)
    })
  }
}


// Call safeFind then convert the results from an array to an object
function safeFindOne(query, options, cb) {

  options.method = 'findOne'
  options.limit = 1
  safeFind.call(this, query, options, function(err, docs, meta) {
    if (err) return cb(err)

    var doc = null
    if (docs && docs.length) doc = docs[0]

    // Delete find metadata that does not apply to findOne
    if (meta && tipe.isObject(meta)) {
      delete meta.sort
      delete meta.limit
      delete meta.skip
      delete meta.more
    }

    // Return results
    return cb(null, doc, meta)
  })
}


// Find the first document in a query ordered by _id
function safeFirst(query, options, cb) {
  options = options || {}
  options.sort = [{_id: 1}]
  safeFindOrderedById.call(this, query, options, cb)
}


// Find the last document in a query ordered by _id
function safeLast(query, options, cb) {
  options = options || {}
  options.sort = [{_id: -1}]
  safeFindOrderedById.call(this, query, options, cb)
}


// Find the first or last document in a query ordered by _id
function safeFindOrderedById(query, options, cb) {
  query = query || {}
  options = options || {}
  options.limit = 1
  options.sort = options.sort || [{_id: -1}]
  this.safeFind(query, options, function(err, docs, meta) {
    if (err) return cb(err)
    if (!docs.length) return cb(null, null, meta)
    cb(null, docs[0], meta)
  })
}


// Asycronously walk a query, serially, one document
// at a time, applying fn to each document.  If any
// errors are raised immediately return them to the
// callback and stop
function safeEach(query, options, fn, cb) {

  if (!tipe.isFunction(cb)) cb = logErr

  query = query || {}
  options = options || {}

  var collection = this
  var count = 0

  safeLast.call(this, query, options, function(err, lastDoc) {
    if (err) return cb(err)
    if (!lastDoc) return cb(null, count)

    var _id = ''
    var lastId = lastDoc._id

    options.sort = [{_id: 1}]
    options.limit = 1

    findNext(_id)

    function findNext(_id) {

      var nextDocQuery = (_.isEmpty(query))
        ? {_id: {$gt: _id}}
        : {$and: [query, {_id: {$gt: _id}}]}

      collection.safeFind(nextDocQuery, options, function(err, docs) {
        if (err) return cb(err)

        if (!docs.length) {  // done
          util.print('\n')
          return cb(null, count)
        }

        var doc = docs[0]
        var docId = doc._id

        if (docId > lastId) return cb(null, count)  // done

        // apply the caller's function to the doc
        fn(doc, function(err) {
          if (err) return cb(err)
          count++
          if (count % 1000 === 0) util.print('.')
          findNext(docId)
        })
      })
    }
  })
}


// Validate the collection, scrub the options, then run the schema read
// befores. Return potentially modified query and options on success
function validate(collection, query, options, cb) {

  if (!collection.schema) return cb(new Error('Unknown collection ' + collection.collectionName))

  var err = scrub(options, safeFindSpec, {db: collection.db})

  if (err) {
    if (err.details && err.details.options) {
      delete err.details.options.db   // remove internal var from error message
    }
    return cb(err)
  }

  async.eachSeries(collection.schema.before.read, callBefore, finish)

  function callBefore(before, next) {
    // TODO: wrap in util.timeLimit
    before.call(collection, query, options, function(err, newQuery, newOptions) {
      if (err) return next(err)
      if (newQuery) query = newQuery
      if (newOptions) options = newOptions
      // If a validator populates the results property of options
      // return immediately and send them
      if (tipe.isDefined(options.results)) return finish()
      next()
    })
  }

  function finish(err) {
    if (err) return cb(err)
    cb(null, query, options)
  }
}


// For a document or array of documents perform optional
// ref lookups and date format conversion
function decorate(collection, docs, options, cb) {

  var docsWasObject = false

  if (tipe.isObject(docs)) {
    docsWasObject = true
    docs = [docs]
  }

  if (options.utc) {
    docs.forEach(function(doc) {
      for (var fieldName in doc) {
        if (fieldName.match(/Date/) && tipe.isNumber(doc[fieldName])) {
          doc[fieldName] = new Date(doc[fieldName]).toUTCString()
        }
      }
    })
  }

  if (options.refs) {
    getRefs(collection, docs, options, finish)
  }
  else finish(null, docs)

  function finish(err, docs) {
    if (err) return cb(err)
    if (docsWasObject) docs = docs[0] // convert back
    cb(null, docs)
  }
}


// Informational method attached to the db object describing the find spec
function getSafeFindSpec() {
  return _.cloneDeep(safeFindSpec)
}


exports.config = config
exports.extend = extend
