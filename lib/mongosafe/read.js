/**
 * Mongoread: extend mongodb native find
 */

var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var agg = require('./agg')

var _config = {
  limits: {
    default: 50,
    max: 1000,
    join: 1000,
  },
}

function config(options) {
  if (tipe.isObject(options)) {
    _.extend(_config, options)
  }
  return _config
}

var fieldSpec = exports.fieldSpec = {
  type: 'object|string',
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
    return Math.min(v, _config.limits.max)
  }
}

var linkSpec = exports.linkSpec = {
  strict: false,
  value: parse.arg,
}

var links = require('./links') // must be declared after specs

var safeFindSpec = {
  query:      {type: 'object', strict: false},  // mongodb pass-through query clause
  fields:     fieldSpec,
  count:      {type: 'boolean'},
  genId:      {type: 'boolean'},
  countBy:    {type: 'array', value: {type: 'string'}},
  skip:       {type: 'number'},
  limit:      limitSpec,
  refs:       {type: 'boolean|string|object'},
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

    var args = parse.args(arguments)
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
      validator.call(collection, args.query, args.options, function(err, query, options) {
        if (err) return next(err)
        if (query) args.query = query
        if (options) args.options = options
        next()
      })
    }

    function run(err) {
      if (err) return args.cb(err)
      safeFind(collection, args.query, args.options, args.cb)
    }

  }

  // Return a single object rather than an array
  Collection.prototype.safeFindOne = function() {

    var args = parse.args(arguments)
    if (tipe.isError(args)) return args
    args.options.limit = 1

    Collection.prototype.safeFind.call(this, args.query, args.options, function(err, docs, meta) {
      if (err) return args.cb(err)
      args.cb(null, docs[0] || null, meta)
    })
  }

  Collection.prototype.getRefs = getRefs

  // Informational method describing safeFind's expected argument signiture
  mongo.Db.prototype.safeFindSpec = function() { return safeFindSpec }

  return mongo
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
    else return cb(null, {_id: id})
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
  if (options.countBy) return agg.countBy(collection, selector, options, function(err, docs) {
    if (err) return cb(err)
    decorate(docs, cb)
  })

  // Find pipeline
  async.waterfall([
    find,
    getLinked,
    sort,
    skip,
    limit,
    getRefs,
    decorate,
  ], cb)

  // Regular find
  function find(next) {
    collection.find(selector, options).toArray(next)
  }

  // Get the linked documents
  function getLinked(docs, next) {

    if (docs.length && options.links) {
      if (docs.length > _config.limits.join) {
        return next(perr.excededLimit('Cannot use links on results larger than ' +
            _conf.limits.join + '. Restrict your query further and try again.') )
      }
      // imp goes here
      return next(null, docs)
      // links.get(collection, query, options, docs, next)
    }
    else next(null, docs)
  }

  function sort(docs, next) {
    // implement
    next(null, docs)
  }

  function skip(docs, next) {
    // implement
    next(null, docs)
  }

  function limit(docs, next) {
    // implement
    next(null, docs)
  }

  function decorate(docs, next) {

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
    var meta = {
      count: docs.length,
      more: more
    }
    next(null, docs, meta)
  }

}


// Populate refs (aka foreign keys) with data from referenced collections
// Refs can be static, meaning one key always points to one collection,
// or dynaminc, meaning one key can point to one collection for one document,
// and another collection for another document.  For dynamic refs, the ref
// property of the schema is a function that returns the name of the schema
// that this key of this document's points to.  The _links collection uses
// these dynamic joins
function getRefs(docs, options, cb) {

  var collection = this
  var db = this.db

  if (docs.length > _config.limits.join) {
    return cb(perr.excededLimit('Cannot use refs on results larger than ' +
        _conf.limits.join + '. Restrict your query further and try again.') )
  }

  var refs = collection.schema.refs
  var refQuery = parse.arg(options.refs)
  if (tipe.isError(refQuery)) return cb(err)
  if (!(tipe.isBoolean(refQuery) || tipe.isObject(refQuery))) {
    return cb(perr.serverError('Could not parse refs query', options.refs))
  }

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
    db[clName].safeFind({_id: {$in: ids}}, ops, function(err, refDocs, meta) {
      if (err) {
        // 401 means the user doesn't have permissions to read the collection,
        // so skip.  This will happen for owner-access collections when user
        // is not authenticated
        if (401 === err.code) return nextCl()
        else return finish(err)  // unexpected
      }
      if (!(refDocs && refDocs.length)) return nextCl()
      refDocs.forEach(function(refDoc) {
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

        if (tipe.isBoolean(refQuery)) {
          if (refQuery) doc[refFieldName] = refDoc
        }
        else {
          var keys = Object.keys(refQuery)
          if (keys.length === 1) {
            // refs = 'name' or refs = {name: 1}
            // don't nest object, set ref to value
            if (refDoc[keys[0]]) doc[refFieldName] = refDoc[keys[0]]
          }
          else {
            // create a nested object with all the listed fields
            doc[refFieldName] = {}
            for (var field in refQuery) {
              if (refDoc[field]) doc[refFieldName][field] = refDoc[field]
            }
            if (_.isEmpty(doc[refFieldName])) delete doc[refFieldName]
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



exports.config = config
exports.extend = extend
