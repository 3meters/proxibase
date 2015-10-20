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
  value: parse.sort,
  validate: function(v) {
    if (!v && _config.sort) v = _config.sort
  }
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
    nQueries:       {type: 'number', default: 0},
    timeout:        {type: 'number'},
    tag:            {type: 'string'},           // http request tag
    user:           {type: 'object', value: {
      _id: {type: 'string', required: true},
      role: {type: 'string', required: true},
    }}
  }, validate: function(v) {
    if (['findOne', 'count', 'countBy'].indexOf(v.method) >= 0) {
      delete v.sort
      delete v.skip
      delete v.more
      v.limit = -1    // If limit is deleted the mongodb driver throws.  Nice.
    }
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
    runSafeFind(collection, query, options, cb)
  }

  // Set request timeout to -1 to run without time limit
  var timeout = tipe.isNumber(options.timeout) ? options.timeout : _config.timeout

  if (timeout > 0) util.timeLimit(fn, timeout, cb)  // remember that if (-1) is true in javascript
  else fn(cb)
}


function debugOps(ops, msg) {
  msg = msg || ''
  var o = _.cloneDeep(ops)
  if (o.user) o._user = o.user._id
  delete o.user
  // debug('ops ' + msg + ':', o)
}

function runSafeFind(collection, query, ops, cb) {

  // Start the timer for the outer query, including validation
  var outerTimer = util.timer()
  var clName = collection.collectionName

  var selector = query.query || query || {}

  optimizeSelector(selector)

  debugOps(ops, 'prevalidate')
  // Validate may make recursive calls into safeFind
  validate(collection, query, ops, runQuery)

  // Call the database and retrieve the results
  // This function modifies options which are passed to after triggers
  function runQuery(err, collection, query, ops) {

    if (err) return cb(err)

    debugOps(ops, 'post validate')

    // Diagnostics
    if (ops.debug) {
      log('safeFind query on ' + clName + ':', selector)
      log('safeFind options:', ops)
    }

    // The before triggers may already know the answer to the query.  If they do,
    // they can put the results in ops.results.  If we find results on ops, we
    // return them without round tripping.
    if (tipe.isDefined(ops.results)) return processResults(null, ops.results)

    // Generate a valid collection _id
    if (ops.genId) {
      var id = collection.genId(query)
      if (tipe.isError(id)) return cb(id)
      else return cb(null, {_id: id})
    }

    // Start the timer for the inner queries
    ops.timer = util.timer()

    // Count
    if (ops.count) {
      delete ops.limit
      return collection.find(selector, ops).count(processResults)
    }

    // CountBy
    if (ops.countBy) {
      delete ops.limit
      return agg.countBy(collection, selector, ops, processResults)
    }

    // Call the findOne method instead of find
    if (ops.method === 'findOne') {
      //  return collection.findOne(selector, ops, processResults)
    }

    // More means ask if there are more results that would have satisfied the query
    // that are are not returned due to the limit
    if (ops.more) ops.limit++

    // Regular Find
    ops.method = ops.method || 'find'

    collection.find(selector, ops).toArray(processResults)

    // Decorate the results and call back
    function processResults(err, results) {
      if (err) return cb(err)

      if (ops.method === 'find' || ops.method === 'findOne') {
        var out = ops.method + ' doc '
        if (ops.timer) out += 't:' + ops.timer.read() + ' '
        out += JSON.stringify(selector)
        // debug(out)
      }

      // Log slow queries
      if (ops.timer) {
        var time = ops.timer.read()
        if (_config.logSlow && time > _config.logSlow) {
          logSlow(time, clName, selector, ops, err, results)
        }
        delete ops.timer
      }

      // We got back one more document that we asked for, set the more flag
      if (tipe.isArray(results) && results.length >= ops.limit && ops.more) {
        results.pop()
        ops.hasMore = true
        ops.limit--
      }

      // Get links or linked documents
      if (ops.links || ops.linked || ops.linkCount) {
        var linkOps = {
          user: ops.user,
          asAdmin: ops.asAdmin,
          asReader: ops.asReader,
          links: ops.links,
          linked: ops.linked,
          linkCount: ops.linkCount,
          tag: ops.tag,
        }
        links.get(collection, results, linkOps, finish)
      }
      else finish(err, results)
    }

    // Wrap up
    function finish(err, results) {
      if (err) return cb(err)

      decorate(collection, results, ops, function(err, results) {
        if (err) return cb(err)

        // Set the count property for a mixed-type result
        switch (tipe(results)) {
          case 'array':
            ops.count = results.length
            break
          case 'object':
            ops.count = 1
            break
          case 'number':
            ops.count = results
            break
          default:
            ops.count = 0
        }

        if (ops.more) {
          if (ops.hasMore) ops.more = true
          else ops.more = false
        }

        if (ops.method === 'findOne') {
          if (tipe.isArray(results)) {
            results = results.length ? results[0] : null
          }
        }

        ops.dbTime = outerTimer.read()  // includes validation
        var after = collection.schema.after.read

        if (!after) return cb(null, results, ops)

        var scope = {
          results: results,
          options: ops,
        }
        after.call(collection, null, scope, cb)
      })
    }
  }
}


// Call safeFind then convert the results from an array to an object
function safeFindOne(query, options, cb) {
  var err = parse.args(arguments)
  if (err) return cb(err)
  options.method = 'findOne'
  safeFind.call(this, query, options, cb)
}


// Find the first document in a query ordered by _id
function safeFirst(query, options, cb) {
  var err = parse.args(arguments)
  if (err) return cb(err)
  options.sort = options.sort || [{_id: 1}]
  safeFindOrderedById.call(this, query, options, cb)
}


// Find the last document in a query ordered by _id
function safeLast(query, options, cb) {
  var err = parse.args(arguments)
  if (err) return cb(err)
  options.sort = options.sort || [{_id: -1}]
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
    cb(null, collection, query, options)
  }
}


// For a document or array of documents perform optional
// ref lookups and date format conversion
function decorate(collection, results, options, cb) {

  if (!(options.refs || options.utc)) return cb(null, results)

  var resultType = tipe(results)
  if ((resultType !== 'object') && (resultType !== 'array')) {
    return cb(null, results)
  }

  // Convert to array
  if (resultType === 'object') results = [results]

  if (options.utc) {
    results.forEach(function(doc) {
      for (var fieldName in doc) {
        if (fieldName.match(/Date/) && tipe.isNumber(doc[fieldName])) {
          doc[fieldName] = new Date(doc[fieldName]).toUTCString()
        }
      }
    })
  }

  if (options.refs) {
    getRefs(collection, results, options, finish)
  }
  else finish(null, results)

  function finish(err, results) {
    if (err) return cb(err)
    if (resultType === 'object') results = results[0] // convert back
    cb(null, results)
  }
}


// This is code that should live inside the mongodb query processor
// but does not as of version 2.6.10 and 3.0.3.
function optimizeSelector(selector) {
  if (!tipe.isObject(selector)) return
  for (var key in selector) {
    if (selector[key] && selector[key].$in && selector[key].$in.length === 1) {
      selector[key] = selector[key].$in[0]
    }
  }
}


// Write slow queries to the error log
function logSlow(time, clName, selector, ops, err, results) {
  var logErr = util.logErr
  logErr('\n=============')
  logErr('safeFind slow query on ' + clName + ': ', time)
  logErr('date: ' + util.nowUTC())
  logErr('request: ' + ops.tag)
  logErr('selector', selector)
  logErr('ops', ops)
  if (err) logErr('err', err)
  if (ops.method === 'countBy') {
    logErr('counts:', results)
  }
  else {
    if (results && results.length) logErr('count: ' + results.length)
  }
  if (!ops.tag) logErr('results missing tag', results)
  util.logErr('===============')
}


exports.optimizeSelector = optimizeSelector
exports.logSlow = logSlow
exports.config = config
exports.extend = extend
