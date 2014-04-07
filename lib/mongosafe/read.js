/**
 * Mongoread: extend mongodb native find
 */

var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')

var _config = {
  limits: {
    join: 100000,
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
  type: 'object|array|string',
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

var safeFindSpec = {
  query:      {type: 'object'},  // mongodb pass-through query clause
  fields:     {type: 'object|array'},
  count:      {type: 'boolean'},
  genId:      {type: 'boolean'},
  countBy:    {type: 'array', value: {type: 'string'}},
  skip:       {type: 'number'},
  limit:      limitSpec,
  refs:       {type: 'boolean|string'},
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

    var err = scrub(args.options, safeFindSpec, {db: collection.db})
    if (err) {
      if (err.details && err.details.options) {
        delete err.details.options.db   // remove internal var from error message
      }
      return args.cb(err)
    }

    async.eachSeries(this.schema.validators.read, callValidator, run)

    function callValidator(validator, next) {
      // TODO: wrap in util.setLimit
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

  // Informational method describing safeFind's expected argument signiture
  mongo.Db.prototype.safeFindSpec = function() { return safeFindSpec }

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


  // Get the linked documents
  function getLinkedDocuments(err, docs) {
    if (err) return cb(err)

    if (options.links) {
      links.get(collection, query, options, docs, processResults)
    }
    else processResults(err, docs)
  }


  // Populate refs (aka foreign keys) with data from referenced collections
  // Refs can be static, meaning one key always points to one collection,
  // or dynaminc, meaning one key can point to one collection for one document,
  // and another collection for another document.  For dynamic refs, the ref
  // property of the schema is a function that returns the name of the schema
  // that this key of this document's points to.  The _links collection uses
  // these dynamic joins
  function getRefs(docs, cb) {

    if (docs.length > _config.limits.join) {
      logErr('getRefs called on collection larger than ' + config.limits.join + '. skipping')
      return cb()
    }

    var refs = collection.schema.refs
    var refMap = {}

    docs.forEach(function(doc) {
      Object.keys(refs).forEach(function(field) {
        if (!doc[field]) return
        // Ref can be the name of a collection or a function that
        // returns a collection name based on a value in the doc
        var clName = getRefClName(refs[field], doc)
        if (!(clName && db.safeCollection(clName))) return
        refMap[clName] = refMap[clName] || {}
        refMap[clName][doc[field]] = null  // map the id
      })
    })

    async.each(Object.keys(refMap), getRefDocs, finish)

    function getRefDocs(clName, nextCl) {

      // Convert to an ordered array for passing to mongodb find $in
      var ids = Object.keys(refMap[clName]).sort()

      // Get the referenced documents
      var ops = {
        user: options.user,
        asAdmin: options.asAdmin
      }
      db[clName].safeFind({_id: {$in: ids}}, ops, function(err, refDocs) {
        if (err) {
          // 401 means the user doesn't have permissions to read the collection,
          // so skip.  This will happen for owner-access collections when user
          // is not authenticated
          if (401 === err.code) return nextCl()
          else return finish(err)  // unexpected
        }
        if (!(refDocs && refDocs.data)) return nextCl()
        refDocs.data.forEach(function(refDoc) {
          refMap[clName][refDoc._id] = refDoc   // the rub
        })
        nextCl()
      })
    }

    function finish(err) {
      if (err) return cb(err)
      // graft in the results
      docs.forEach(function(doc) {
        for (var field in refs) {
          if (!doc[field]) continue
          var clName = getRefClName(refs[field], doc)
          if (!clName) continue
          // strip the leading _ from the key name for the ref value name
          var refFieldName = (field === '_id')
            ? 'name'            // self join
            : field.slice(1)    // e.g. _owner => owner
          var refDoc = refMap[clName][doc[field]]
          if (!refDoc) continue
          /*
           *  Graft in the ref document. Its shape is determined by the refs param.
           *  refs is truthy, e.g. true or on or 1,
           *     the entire ref doc is nested
           *  refs is a string naming just one field, e.g. refs=name,
           *     the value of that field is promoted
           *  refs is a comma-separated list of field names, e.g. refs=_id,name,role,
           *     the specified fields of the rest doc are nested
           */
          if (tipe.isTruthy(options.refs)) {
            doc[refFieldName] = refDoc
          }
          else {
            if (tipe.isString(options.refs)) {
              var fieldList = options.refs.split(',')
              if (fieldList.length === 1) {
                if (refDoc[fieldList[0]]) doc[refFieldName] = refDoc[fieldList[0]]
              }
              else {
                doc[refFieldName] = {}
                /* jshint -W083 */
                fieldList.forEach(function(field) {
                  if (refDoc[field]) doc[refFieldName][field] = refDoc[field]
                })
                if (_.isEmpty(doc[refFieldName])) delete doc[refFieldName]
              }
            }
          }
        }
      })
      delete options.refs
      cb(err, docs)
    }
  }

  // Refs can be strings or a function based on values in the doc
  // Returns a string or null
  function getRefClName(ref, doc) {
    var clName = (tipe.isFunction(ref)) ? ref(doc) : ref
    return (tipe.isString(clName)) ? clName : null
  }

  function processResults(err, docs) {

    if (err) return cb(err)

    if (options.refs) return getRefs(docs, processResults)
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
 *   query string format:       '-field1,field2,-field3'
 */
function formatSort(sort) {

  switch (tipe(sort)) {
    case 'string':
      var fields = sort.replace(/\s+/g, '').split(',')  // strip whitespace
      sort = []
      fields.forEach(function(field) {
        // to sort descending prefix field name with '-'
        if (field.match(/^\-/)) sort.push([field.slice(1), 'desc'])
        else sort.push([field, 'asc'])
      })
      return sort
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
