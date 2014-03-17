/**
 * Mongoread: extend mongodb native find
 */

var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')

var _config = {
  limits: {
    default: 1000,
    max: 10000
  },
  sort: {_id: 1},
}

function config(options) {
  if (tipe.isObject(options)) {
    _.extend(_config, options)
  }
  return _config
}

var sortSpec = exports.sortSpec = {
  type: 'object|array',
  default: function() { return _config.sort },
  value: formatSort
}

var limitSpec = exports.limitSpec = {
  type: 'number',
  default: function() { return _config.limits.default },
  value: function(v) {
    return Math.min(v, _config.limits.max)
  }
}

var links = require('./links')

var opsSpec = {
  query:      {type: 'object'},  // mongodb pass-through query clause
  fields:     {type: 'object|array'},
  count:      {type: 'boolean'},
  genId:      {type: 'boolean'},
  countBy:    {type: 'array', value: {type: 'string'}},
  skip:       {type: 'number'},
  limit:      limitSpec,
  lookups:    {type: 'boolean'},
  datesToUTC: {type: 'boolean'},
  sort:       sortSpec,
  links:      links.linksQuerySpec,
  user:       {type: 'object', value: {
    _id: {type: 'string', required: true},
    role: {type: 'string', required: true},
  }}
}

function extend(mongo) {

  var Collection = mongo.Collection

  Collection.prototype.safeFind = function() { // query, options, cb

    var args = parseArguments(arguments)
    if (tipe.isError(args)) return args

    var collection = this
    if (!collection.schema) return args.cb(new Error('Unknown collection ' + collection.collectionName))

    var err = scrub(args.options, opsSpec, {db: collection.db})
    if (err) {
      if (err.details && err.details.options) {
        delete err.details.options.db   // remove internal var from error message
      }
      return args.cb(err)
    }

    async.eachSeries(this.schema.validators.read, callValidator, run)

    function callValidator(validator, next) {
      // TODO: wrap in until.setLimit
      validator.call(collection, args.query, args.options, next)
    }

    function run(err) {
      if (err) return args.cb(err)
      safeFind(collection, args.query, args.options, args.cb)
    }

  }

  // Return a single object rather than an array
  Collection.prototype.safeFindOne = function() {

    var args = parseArguments(arguments)
    if (tipe.isError(args)) return args
    args.options.limit = 1

    Collection.prototype.safeFind.call(this, args.query, args.options, function(err, results) {
      if (err) return args.cb(err)
      return (results.data && results.data.length)
        ? args.cb(null, results.data[0])
        : args.cb(null, null)
    })
  }

  // Information method describing expected argument signiture
  Collection.prototype.safeFind.schema =
  Collection.prototype.safeFindOne.schema =
  function() { return opsSpec }

  return mongo
}


// Make sense of the mixed function signiture
function parseArguments(args) {  // args is arguments from the caller

  var err, parsedArgs = {}

  // The last argument must be a function
  parsedArgs.cb = args[args.length -1]
  if (!tipe.isFunction(parsedArgs.cb)) {
    err = new Error('safeFind expects a callback function as its last argument')
    console.error(err.stack||err)
    return err
  }

  if (args.length >= 3) {
    parsedArgs.query = args[0]
    parsedArgs.options = args[1]
  }
  else if (args.length === 2) {
    parsedArgs.query = args[0]
    parsedArgs.options = {}
  }
  else {
    parsedArgs.query = {}
    parsedArgs.options = {}
  }

  return parsedArgs
}


function safeFind(collection, query, options, cb) {

  var db = collection.db
  var selector = query.query || query || {}
  var outerQueryLimit = options.limit

  options.limit = outerQueryLimit + 1 // cheap trick

  // genId
  if (options.genId) {
    var id = collection.genId(query)
    if (tipe.isError(id)) return cb(id)
    else return cb(null, {data: {_id: id}})
  }

  // Count
  if (options.count) {
    return collection.find(selector, options)
      .count(function (err, count) {
        if (err) return cb(err)
        cb(null, {count:count})
      })
  }

  // CountBy
  if (options.countBy) return aggregateBy(selector, 'countBy', options.countBy)

  // Regular find
  return collection.find(selector, options).toArray(getLinkedDocuments)

  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(selector, agg, groupOn) {

    // Make sure all the groupOn fields are in the schema
    var badFields = groupOn.filter(function(field) {
      return !collection.schema.fields[field]
    })
    if (badFields.length) return cb(perr.badParam(badFields))

    switch (agg) {
      case 'countBy':
        var map = function() {
          var self = this
          var id = {}
          groupOn.forEach(function(field) {
            id[field] = self[field]
          })
          /* global emit */
          emit(id, 1)
        }
        var reduce = function(key, vals) {
          var count = 0
          vals.forEach(function(val) { count+= val })
          return count
        }
        break
      default:
        return cb(new Error('Invalid call to aggregateBy'))
    }
    var mrOps = {
      query: selector,
      scope: {groupOn: groupOn}, // local vars passed to mongodb
      out: {inline: 1}
    }
    collection.mapReduce(map, reduce, mrOps, function(err, docs) {
      if (err) return cb(err)
      var results = []
      docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
      // mongo returns very generic looking results from map reduce operations
      // transform those results back into the terms of the original query
      docs.forEach(function(doc) {
        var result = {}
        groupOn.forEach(function(field) {
          result[field] = doc._id[field]
        })
        result[agg] = doc.value
        results.push(result)
      })
      return processResults(null, results)
    })
  }


  /*
   * Get the linked documents
   */
  function getLinkedDocuments(err, docs) {
    if (err) return cb(err)

    if (options.links) {
      links.get(collection, query, options, docs, processResults)
    }
    else processResults(err, docs)
  }


  /*
   * getLookups: populate refs (aka foreign keys) with the name property
   *   of the referenced collection
   *
   * @docs  array of documents
   * @refs  boolean or object.  If boolean lookup value from the schema of
   *        the collection otherwise {field:collection}
   * @cb    cb
   */
  function getLookups(docs, cb) {

    var refs = collection.schema.refs
    var parents = {} // map of parent collections, often only one: users
    var refNames = {}  // name of property looked-up value will be stored in
    for (var field in refs) {
      parents[refs[field]] = true
      refNames[field] = field === '_id'
        ? 'name'           // self join
        : field.slice(1)   // e.g. _owner => owner
    }

    // For each lookup table, even if several fields point to the same table
    async.each(Object.keys(parents), lookupValues, finish)

    // Make a map of all the unique _ids to be looked up
    function lookupValues(parent, next) {
      var valMap = {}
      docs.forEach(function(doc) {
        for (var field in refs) {
          if (doc[field]) valMap[doc[field]] = null
        }
      })

      // Convert to an ordered array for passing to mongodb find $in
      var vals = Object.keys(valMap).sort()

      // Look up the cooresponding name properties
      db.collection(parent).find({_id: {$in: vals}, name: /.*/}, {name: 1})
        .toArray(function(err, lookups) {
          if (err) return next(err)
          lookups.forEach(function(lookup) {
            valMap[lookup._id] = lookup.name  // add the name to valMap
          })
          // graft back in the names into the original documents array
          docs.forEach(function(doc) {
            for (var field in refs) {
              var val = valMap[doc[field]]
              if (val) doc[refNames[field]] = val  // e.g. doc.owner = george
            }
          })
          next()
        })
    }
    function finish(err) {
      options.lookups = false
      cb(err, docs)
    }
  }


  function processResults(err, docs) {

    if (err) return cb(err)

    if (options.lookups) return getLookups(docs, processResults)
    var more = false
    if (docs.length > outerQueryLimit) {
      docs.pop()
      more = true
    }
    if (options.datesToUTC) {
      docs.forEach(function(doc) {
        for (var fieldName in doc) {
          if ((fieldName.indexOf('Date') >= 0) &&
               tipe.isNumber(doc[fieldName])) {
            doc[fieldName] = new Date(doc[fieldName]).toUTCString()
          }
        }
      })
    }
    var body = {
      data: docs,
      count: docs.length,
      more: more
    }
    return cb(null, body)
  }
}

/*
 * For some reason the javascript driver wants the sort
 * specified in a different format than the mongo console.
 * We support the driver syntax as passthrough, or convert
 * the mongo console syntax to the syntax the driver accepts
 *
 *   mongo console format:      [{field1: 1}, {field2: -1}]
 *   javascript driver format:  [['field1', 'asc'], ['field2', 'desc']]
 *                         or:  {field1: 1}
 *                         or:  'field1'
 */
function formatSort(sort) {

  switch (tipe(sort)) {
    case 'string':
      return [sort, 'ascending']
      break
    case 'object':
      return [convert(sort)]
      break
    case 'array':
      for (var i = 0; i < sort.length; i++) {
        if (tipe.isObject(sort[i])) sort[i] = convert(sort[i])
      }
      return sort
  }

  // convert {field1: 1} to ['field1', 'asc']
  function convert(obj) {
    var key = Object.keys(obj)[0]    // ignore all but the first key
    return (tipe.isTruthy(obj[key]))
      ? [key, 'asc']
      : [key, 'desc']
  }
}


exports.config = config
exports.extend = extend
