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
  // If mongosafe were decoupled from proxibase this
  // would be passed on at config
  clNameFromId: util.clNameFromId,
}

// Set config options or return a safe copy
function config(options) {
  if (tipe.isObject(options)) {
    _.config = _.assign(_config, options)
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
  value: parse.sort,
}

var limitSpec = exports.limitSpec = {
  type: 'number',
  default: function() { return _config.limits.default },
  value: function(v) {
    // 0 means unlimited in in mongo, which we disallow: set to max
    if (v === 0) return _config.limits.max
    // silently reduce, do not error
    return Math.min(v, _config.limits.max)
  },
}

// Links imports from the specs above. Must be required here.
links = require('./links')

var findSpec = {
  type: 'object', value: {
    query:          {type: 'object', strict: false},  // mongodb pass-through query clause
    fields:         fieldSpec,
    count:          {type: 'boolean|number'},
    genId:          {type: 'boolean'},
    countBy:        {type: 'array', value: {type: 'string'}},
    sort:           sortSpec,
    skip:           {type: 'number', default: 0},
    limit:          limitSpec,
    more:           {type: 'boolean'},
    refs:           {type: 'boolean|string|object|number'}, // TODO: get from refs module
    utc:            {type: 'boolean'},
    linkCount:      {type: 'object|array'},
    links:          {type: 'object|array'},
    linked:         {type: 'object|array'},
    debug:          {type: 'boolean'},
    explain:        {type: 'boolean'},
    deoptimize:     {type: 'boolean'},
    timeout:        {type: 'number'},
    tag:            {type: 'string'},           // http request tag
    user:           {type: 'object', value: {
      _id: {type: 'string', required: true},
      role: {type: 'string', required: true},
    }}
  }
}


// Add safeFind methods to mongo Collection constructor
function extend(mongo) {

  var clproto = mongo.Collection.prototype
  var dbproto = mongo.Db.prototype

  // Collection methods
  clproto.safeFind = safeFind
  clproto.safeFindOne = safeFindOne
  clproto.safeFirst = safeFirst
  clproto.safeLast = safeLast
  clproto.safeEach = safeEach

  // Database methods
  dbproto.safeFindById = safeFindById
  dbproto.safeFindByIds = safeFindByIds

  // Publish the specs
  mongo._safeSpecs.field = fieldSpec
  mongo._safeSpecs.sort = sortSpec
  mongo._safeSpecs.limit = limitSpec
  mongo._safeSpecs.find = findSpec

  mongo._safeSpecs = _.assign(mongo._safeSpecs, links._safeSpecs)

}


// safeFind public method
function safeFind(query, options, cb) {

  var err = parse.args(arguments)
  query = arguments[0]
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)

  var collection = this

  // Check the collection
  if (!collection.schema) return cb(perr.serverError('Unknown collection ' + collection.collectionName))

  // Scrub the options
  err = scrub(options, findSpec, {db: collection.db})

  if (err) {
    if (err.details && err.details.options) {
      delete err.details.options.db   // remove internal var from error message
    }
    return cb(err)
  }

  // Package up params to match the signiture util.timeLimit expects
  var fn = function(cb) {
    safeFindParsed(collection, query, options, cb)
  }

  // Set request timeout to -1 to run without time limit
  var timeout = tipe.isNumber(options.timeout) ? options.timeout : _config.timeout

  if (timeout > 0) util.timeLimit(fn, timeout, cb)  // remember that if (-1) is true in javascript
  else fn(cb)
}


function safeFindParsed(collection, query, options, cb) {

  var timer = util.timer()

  var selector = query.query || query || {}

  selector = optimizeSelector(selector)

  // This is code that should live inside the mongodb query processor
  // but does not as of version 2.6.10 and 3.0.3.
  function optimizeSelector(selector) {
    if (options.deoptimize || _config.deoptimize) return selector
    for (var key in selector) {
      if (selector[key] && selector[key].$in && selector[key].$in.length === 1) {
        selector[key] = selector[key].$in[0]
      }
    }
    return selector
  }

  validate(collection, query, options, runQuery)

  // Call the database and retrieve the results
  function runQuery(err, query, options) {

    if (err) return cb(err)

    if (tipe.isDefined(options.results)) return processDocs(null, options.results)

    if (options.more) {
      options.limit++
    }

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
      delete options.limit
      return collection.find(selector, options)
        .count(function (err, count) {
          if (err) return cb(err)
          cb(null, count)
        })
    }

    // CountBy
    if (options.countBy) {
      delete options.limit
      var aggTimer = util.timer()
      return agg.countBy(collection, selector, options, function(err, docs) {
        var t = aggTimer.read()
        if (_config.logSlow && t > _config.logSlow) {
          logSlow(t, selector, options, err, docs)
        }
        processDocs(err, docs)
      })
    }

    // Prune unneeded options from findOne
    if (options.method === 'findOne') {
      delete options.sort
      delete options.skip
      delete options.more
      options.limit = -1
    }

    // Regular Find
    options.method = options.method || 'find'

    var qryTimer = util.timer()
    collection.find(selector, options).toArray(function(err, docs) {
      var t = qryTimer.read()
      if (_config.logSlow && t > _config.logSlow) {
        logSlow(t, selector, options, err, docs)
      }
      processDocs(err, docs)
    })
  }

  function logSlow(time, selector, options, err, docs) {
    var logErr = util.logErr
    logErr('\n=============')
    logErr('safeFind slow query on ' + collection.collectionName + ': ', time)
    logErr('date: ' + util.nowUTC())
    logErr('request: ' + options.tag)
    logErr('selector', selector)
    logErr('options', options)
    if (err) logErr('err', err)
    if (options.method === 'countBy') {
      logErr('counts:', docs)
    }
    else {
      logErr('count: ' + docs.length)
    }
    if (!options.tag) logErr('docs missing tag', docs)
    util.logErr('===============')
  }

  // Decorate the results and call back
  function processDocs(err, docs) {
    if (err) return cb(err)

    // We got back one more document that we asked for, set the more flag
    if (docs && docs.length && docs.length >= options.limit && options.more) {
      docs.pop()
      options.hasMore = true
      options.limit--
    }

    // Get links or linked documents
    if (options.links || options.linked || options.linkCount) {
      var linkOps = {
        user: options.user,
        asAdmin: options.asAdmin,
        asReader: options.asReader,
        links: options.links,
        linked: options.linked,
        linkCount: options.linkCount,
        tag: options.tag,
      }
      links.get(collection, docs, linkOps, finish)
    }
    else finish(err, docs)
  }

  // Wrap up
  function finish(err, docs, meta) {
    if (err) return cb(err)
    if (meta) options = _.assign(options, meta)

    decorate(collection, docs, options, function(err, docs) {
      if (err) return cb(err)

      options.count = docs.length
      options.dbTime = timer.read()

      if (options.more) {
        if (options.hasMore) options.more = true
        else options.more = false
      }

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

  options = _.cloneDeep(options)
  options.method = 'findOne'
  options.limit = 1
  delete options.sort
  delete options.skip

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


// find a single document by id, looking up the collection
// name by parsing the id using the function clNameFromId
function safeFindById(id, options, cb) {

  var _db = this
  var err = parse.args(arguments, {validTypes: ['string']})
  id = arguments[0]
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)
  safeFindByIdParsed(_db, id, options, cb)
}


function safeFindByIdParsed(_db, id, options, cb) {

  // function to extract collection name from id
  var clNameFromId = options.clNameFromId || _config.clNameFromId
  var clName = clNameFromId(id)
  if (tipe.isError(clName)) return cb(perr.ServerError(clName))

  if (!clName) return cb()
  var cl = _db[clName]
  safeFindOne.call(cl, {_id: id}, options, cb)
}


// Find an array of documents based only on their ids, parsing
// each id to determine its collection.
function safeFindByIds(ids, options, cb) {

  var _db = this
  var err = parse.args(arguments, {validTypes: ['array']})
  ids = arguments[0]
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)

  var docs = []

  async.eachSeries(ids, findById, finish)

  function findById(id, next) {
    if (!tipe.isString(id)) return next()
    safeFindByIdParsed(_db, id, options, function(err, doc) {
      if (err) return next(err)
      if (doc) docs.push(doc)
      next()
    })
  }

  function finish(err) {
    cb(err, docs, {count: docs.length})
  }
}



// Run the user-defined before validators.  Return potentially modified
// query and options on success.
function validate(collection, query, options, cb) {

  async.eachSeries(collection.schema.before.read, callBefore, finish)

  function callBefore(before, next) {
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

exports.config = config
exports.extend = extend
