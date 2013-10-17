/**
 * Mongoread: extend mongodb native find
 */

var _ = require('underscore')
var tipe = require('tipe')
var chk = require('chk')
var async = require('async')
var mongo = require('mongodb')
var mongolinks = require('./mongolinks')
var Collection = mongo.Collection
var noop = function(){}
var limits = {
  default: 1000,
  max: 10000
}

exports.config = function(options) {
  if (options.limits) limits = options.limits
}

var querySchema = {
  _id:        {type: 'string'},
  ids:        {type: 'array', value: {type: 'string'}},
  id:         {type: 'string'},
  name:       {type: 'string'},
  find:       {type: 'object'},  // mongodb find pass-through
  fields:     {type: 'object|array'},
  sort:       {type: 'object|array'},
  count:      {type: 'boolean'},
  genId:      {type: 'boolean'},
  countBy:    {type: 'array', value: {type: 'string'}},
  skip:       {type: 'number'},
  limit:      {type: 'number', default: limits.default},
  lookups:    {type: 'boolean'},
  datesToUTC: {type: 'boolean'},
  links:      mongolinks.linksQuerySchema,
}

function extendMongodb() {

  Collection.prototype.safeFind = function() { // query, options, cb

    if (!this.schema) return cb(new Error('Unknown schema for collection ' + this.collectionName))
    var args = parseArguments(arguments)
    if (tipe.isError(args)) return args

    var options = {
      safeSchemas: this.db.safeSchemas,
      safeCollections: this.db.safeCollections
    }
    var err = chk(args.query, querySchema, options)
    if (err) return args.cb(err)
    args.query.limit = Math.min(args.query.limit, limits.max)  // TODO: chk should handle this case
    safeFind(this, args.query, args.options, args.cb)

  }

  // Return a single object rather than an array
  Collection.prototype.safeFindOne = function() {

    var args = parseArguments(arguments)
    if (tipe.isError(args)) return args
    args.query.limit = 1

    Collection.prototype.safeFind.call(this, args.query, args.options, function(err, results) {
      if (err) return args.cb(err)
      if (results.data && results.data.length) {
        return args.cb(null, {data: results.data[0], count: 1})
      }
      else {
        return args.cb(null, {data: null, count: 0})
      }
    })
  }

  // Information method describing expected argument signiture
  Collection.prototype.safeFind.schema =
  Collection.prototype.safeFindOne.schema =
  function() { return querySchema }
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
  var selector = {}
  var findOps = {}
  var outerQueryLimit = query.limit

  selector = query.find || {}
  if (query.ids) selector._id = {$in: query.ids}
  if (query.id) selector._id = query.id
  if (query._id) selector._id = query._id

  if (query.name) selector.namelc = new RegExp('^' + query.name.toLowerCase())

  findOps.limit = outerQueryLimit + 1 // cheap trick

  // whitelist valid options
  if (query.fields) findOps.fields = query.fields
  if (query.skip) findOps.skip = query.skip

  // For some reason the javascript driver wants the sort
  // specified in a different format than the mongo console.
  // We support the driver syntax as passthrough, or convert
  // the native syntax to the one the driver wants
  if (query.sort) {
    findOps.sort = []
    if (tipe.array(query.sort)) findOps.sort = query.sort
    else {
      Object.keys(query.sort).forEach(function(key) {
        if (tipe.isTruthy(query.sort[key])) findOps.sort.push([key, 'asc'])
        else findOps.sort.push([key, 'desc'])
      })
    }
  }

  // genId
  if (query.genId) {
    return cb(null, {data: {_id: collection.genId()}})
  }

  // Count
  if (query.count) {
    return collection.find(selector, findOps)
      .count(function process(err, count) {
        if (err) return cb(err)
        cb(null, {count:count})
      })
  }

  // CountBy
  if (query.countBy) return aggregateBy(selector, 'countBy', query.countBy)

  // Regular find
  return collection.find(selector, findOps).toArray(getLinkedDocuments)

  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(selector, agg, groupOn) {

    // Make sure all the groupOn fields are in the schema
    var badFields = groupOn.filter(function(field) {
      return !collection.schema.fields[field]
    })
    if (badFields.length) return cb(perr.badParam(badFields))

    switch(agg) {
      case 'countBy':
        var map = function() {
          var self = this
          var id = {}
          groupOn.forEach(function(field) {
            id[field] = self[field]
          })
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

    if (query.links) {
      mongolinks.get(collection, query, options, docs, validate)
    }
    else validate(err, docs)
  }


  /*
   * Run the read validators on the query results.  These can be used to create
   * calculated fields
   */
  function validate(err, docs, options) { // Options for symetry with write validators?
    if (err) return cb(err)

    var validators = collection.schema.validators
    if (!(validators && validators.read)) return processResults(err, docs, options)

    // validators.read is an array of validator functions
    async.eachSeries(validators.read, validateDocs, options, function(err) {
      processResults(err, docs)
    })

    function validateDocs(validator, next) {
      // TODO: perf test this against each & eachLimit
      async.eachLimit(docs, 10, validateDoc, next)
      function validateDoc(doc, next) {
        validator.call(collection, doc, null, options, next) // doc, previous, options, cb
      }
    }
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
  function getLookups(docs, refs, cb) {

    if (!refs) return cb(docs)
    if (typeof refs !== 'object') refs = _.clone(collection.schema.refs)
    var parents = {} // map of parent collections, often only one: users
    var refNames = {}  // name of property looked-up value will be stored in
    for (field in refs) {
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
            for (field in refs) {
              var val = valMap[doc[field]]
              if (val) doc[refNames[field]] = val  // e.g. doc.owner = george
            }
          })
          next()
        })
    }

    // Delete the lookups property from the request's query and call back
    function finish(err) {
      delete query.lookups
      cb(err, docs)
    }
  }


  function processResults(err, docs) {

    if (err) return cb(err)

    var lookups = query.lookups
    if (lookups) return getLookups(docs, lookups, processResults)
    var more = false
    if (docs.length > outerQueryLimit) {
      docs.pop()
      more = true
    }
    if (query.datesToUTC) {
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

extendMongodb()  // runs on require
