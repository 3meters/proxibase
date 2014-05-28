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
    // silently reduce, do not error
    return Math.min(v, _config.limits.max)
  }
}

var linkSpec = exports.linkSpec = {
  strict: false,
  value: parse.arg,
}

var linksQuerySpec = {
  init: function(v, options) {
    if (tipe.isArray(v)) {
      options.wasArray = true
      return v
    }
    else return [v]
  },
  type: 'array', value: {
    type: 'object', value: {
      to:           linkSpec,  // collections document links to
      from:         linkSpec,  // collections with links to document
      fields:       fieldSpec,
      filter:       {type: 'object', strict: false, default: {}},
      linkFilter:   {type: 'object', strict: false, default: {}},
      linkFields:   fieldSpec,
      sort: {
        type: 'object|array|string',
        default: '-_id',
        value: parse.sort,
      },
      limit:        limitSpec,
      skip:         {type: 'number', default: 0},
      noDocuments:  {type: 'boolean'},
      count:        {type: 'boolean'},
    },
    strict: true,
    validate: validateLinkQuery
  },
  finish: function(v, options) {
    if (options.wasArray) {
      delete options.wasArray
      return v
    }
    else return v[0]
  },
}

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
  links:      linksQuerySpec,
  user:       {type: 'object', value: {
    _id: {type: 'string', required: true},
    role: {type: 'string', required: true},
  }}
}


function extend(mongo) {

  var Collection = mongo.Collection

  // Wrapper for findOne
  Collection.prototype.safeFindOne = function() {

    var collection = this
    var args = parse.args(arguments)
    if (tipe.isError(args)) return args

    validate(collection, args.query, args.options, function(err, query, options) {
      if (err) return args.cb(err)
      safeFindOne(collection, query, options, args.cb)
    })
  }

  // Wrapper for find
  Collection.prototype.safeFind = function() { // query, options, cb

    var collection = this
    var args = parse.args(arguments)
    if (tipe.isError(args)) return args

    validate(collection, args.query, args.options, function(err, query, options) {
      if (err) return args.cb(err)
      safeFind(collection, query, options, args.cb)
    })
  }

  // Called by the stats framework
  Collection.prototype.getRefs = function(docs, options, cb) {
    getRefs(this, docs, options, cb)
  }

  // Informational method describing safeFind's expected argument signiture
  mongo.Db.prototype.safeFindSpec = function() {
    return safeFindSpec
  }

  return mongo
}


// First scrub the query then run the schema read validators. Return potentially
// modified query and options on success
function validate(collection, query, options, cb) {

  if (!collection.schema) return cb(new Error('Unknown collection ' + collection.collectionName))

  var err = scrub(options, safeFindSpec, {db: collection.db})
  if (err) {
    if (err.details && err.details.options) {
      delete err.details.options.db   // remove internal var from error message
    }
    return cb(err)
  }

  async.eachSeries(collection.schema.validators.read, callValidator, finish)

  function callValidator(validator, next) {
    // TODO: wrap in util.timeLimit
    validator.call(collection, query, options, function(err, newQuery, newOptions) {
      if (err) return next(err)
      if (newQuery) query = newQuery
      if (newOptions) options = newOptions
      next()
    })
  }

  function finish(err) {
    if (err) return cb(err)
    cb(null, query, options)
  }
}


function safeFindOne(collection, query, options, cb) {

  collection.findOne(query, options, function(err, doc) {
    if (err) return cb(err)
    if (!doc) return cb(null, null, {count: 0})
    if (options.links) {
      getLinkedDocs(collection, doc, query, options, finish)
    }
    else finish(err, doc)

    function finish(err, doc) {
      if (err) return cb(err)
      decorate(collection, doc, options, function(err, doc) {
        if (err) return cb(err)
        cb(null, doc, {count: 1})
      })
    }
  })
}


function safeFind(collection, query, options, cb) {

  var db = collection.db
  var selector = query.query || query || {}
  var outerQueryLimit = options.limit

  options.limit = outerQueryLimit + 1

  // genId
  if (options.genId) {
    var id = collection.genId(query)
    if (tipe.isError(id)) return cb(id)
    else return cb(null, {_id: id})
  }

  // count
  if (options.count) {
    return collection.find(selector, options)
      .count(function (err, count) {
        if (err) return cb(err)
        cb(null, {count: count})
      })
  }

  // countBy
  if (options.countBy) {
    return agg.countBy(collection, selector, options, finish)
  }

  // regular find
  collection.find(selector, options).toArray(finish)


  // decorate the results and call back
  function finish(err, docs) {
    if (err) return cb(err)

    var more = false
    if (docs.length > outerQueryLimit) {
      docs.pop()
      more = true
    }

    decorate(collection, docs, options, function(err, docs) {
      if (err) return cb(err)
      cb(null, docs, {count: docs.length, more: more})
    })
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

  if (options.datesToUTC) {
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


function getLinkedDocs(collection, doc, query, options, cb) {

  var db = collection.db

  /*
   * Link queries can be a singletons or arrays.
   * Results are returned in matching format.
   * Convert singletons to arrays on the way in and
   * convert the results back out to singletons on
   * the way out
   */
  var linkQueryIsArray = tipe.isArray(options.links)
  if (!linkQueryIsArray) {
    options.links = [options.links]
  }

  doc.links = []

  async.eachSeries(options.links, getLinkq, finish)

  function getLinkq(linkq, nextLinkq) {

    var result = {}
    var skipped = {to: {}, from: {}}

    buildToInClause()

    function buildToInClause() {
      if (!linkq.to) return buildFromInClause()
      result.to = {}
      var selector = _.extend(util.clone(linkq.linkFilter), {_from: doc._id})
      if (!_.isEmpty(linkq.to)) {
        selector.toSchema = {$in: []}
        for (var key in linkq.to) {
          result.to[key] = []  // put result in the order specified
          selector.toSchema.$in.push(db.safeCollection(key).schema.name)
        }
      }
      getLinks(selector, 'to', buildFromInClause)
    }

    function buildFromInClause(err) {
      if (err) return nextLinkq(err)
      if (!linkq.from) return finishLinkQuery()
      result.from = {}
      var selector = _.extend(util.clone(linkq.linkFilter), {_to: doc._id})
      if (!_.isEmpty(linkq.from)) {
        selector.fromSchema = {$in: []}
        for (var key in linkq.from) {
          result.from[key] = []  // put result in the order specified
          selector.fromSchema.$in.push(db.safeCollection(key).schema.name)
        }
      }
      getLinks(selector, 'from', finishLinkQuery)
    }

    function getLinks(selector, direction, cb) {

      doc.cLinks = 0

      // skip will be applied later after filter
      var linkCursorOps = {
        sort: linkq.sort,
        limit: config().limits.join,
        batchSize: 100,
      }

      var cursor = db.links.find(selector, linkCursorOps)
      nextLink()

      function nextLink() {
        cursor.nextObject(function(err, link) {
          if (err || !link) {
            cursor.close()
            return cb(err)
          }

          // https://github.com/3meters/proxibase/issues/208
          if (!db.safeSchema(link.toSchema)) {
            logErr('Invalid link, unrecognized toSchema', link)
            return nextLink()
          }
          if (!db.safeSchema(link.fromSchema)) {
            logErr('Invalid link, unrecognized fromSchema', link)
            return nextLink()
          }

          doc.cLinks++

          var cl = ('to' === direction)
            ? db.safeSchema(link.toSchema).collection
            : db.safeSchema(link.fromSchema).collection

          // Count
          if (linkq.count) {
            result[direction][cl] = result[direction][cl] || 0
            result[direction][cl]++
            return nextLink()
          }

          result[direction][cl] = result[direction][cl] || []

          // Skip: BUG:  this has to happen after doc filter
          /*
          if (linkq.skip) {
            skipped[direction][cl] = skipped[direction][cl] || 0
            if (skipped[direction][cl] < linkq.skip) {
              skipped[direction][cl]++
              return nextLink()
            }
          }
          */

          // Limit  BUG: this has to happen after doc filter
          /*
          if (result[direction][cl].length >= linkq.limit) {
            return nextLink()
          }
          */

          // Get linked doc
          // Whitelist some top-level query options that make sense for linked docs
          var linkField = ('to' === direction) ? link._to : link._from
          var docSelector = _.extend(linkq.filter, {_id: linkField})
          var findDocOps = {
            user: options.user,
            fields: linkq.fields,
            refs: options.refs,
            datesToUTC: options.datesToUTC,
          }
          db[cl].safeFindOne(docSelector, findDocOps, function(err, linkedDoc) {
            // don't fail on errors, just skip, can be lack of read perms
            if (err) return finishGetLink(false)
            if (doc) keep(link, linkedDoc)
            nextLink()
          })

          function keep(link, linkedDoc) {
            if (!linkq.noDocuments) link.document = linkedDoc
            if (!_.isEmpty(linkq.linkFields)) {
              for (var field in link) {
                if ('document' === field) continue
                if ('_id' === field) continue
                if (!linkq.linkFields[field]) delete link[field]
              }
            }
            result[direction][cl].push(link)
          }

        })
      }
    }

    function finishLinkQuery(err) {
      if (err) return nextLinkq(err)
      doc.links.push(result)
      // Convert single element array back to object
      if (!linkQueryIsArray) doc.links = doc.links[0]
      nextLinkq()
    }
  }   // getLinks

  function finish(err) {
    if (err) return cb(err)
    delete doc.cLinks
    cb(null, doc)
  }
}

// Populate refs (aka foreign keys) with data from referenced collections
// Refs can be static, meaning one key always points to one collection,
// or dynaminc, meaning one key can point to one collection for one document,
// and another collection for another document.  For dynamic refs, the ref
// property of the schema is a function that returns the name of the schema
// that this key of this document's points to.  The _links collection uses
// these dynamic joins
function getRefs(collection, docs, options, cb) {

  var db = collection.db

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

/*
 * Ensure that the specified to and from links are
 * known safeCollection names
 * if link.to or link.from are booleans set them to {}, meaning all linked records
 */
function validateLinkQuery(linkq, options) {
  var key, db = options.db

  if (!(linkq.from || linkq.to)) return 'must specify either from or to'

  if (tipe.isDefined(linkq.to) && !tipe.isObject(linkq.to)) {
    if (tipe.isTruthy(linkq.to)) linkq.to = {}
    else return 'to: must be an object or a truthy value'
  }
  for (key in linkq.to) {
    if (!db.safeCollection(key)) return 'Unknown collection: ' + key
    if (!linkq.to[key]) delete linkq.to[key]      // {cl: -1}
  }

  if (tipe.isDefined(linkq.from) && !tipe.isObject(linkq.from)) {
    if (tipe.isTruthy(linkq.from)) linkq.from = {}
    else return 'from: must be an object or a truthy value'
  }
  for (key in linkq.from) {
    if (!db.safeCollection(key)) return 'Unknown collection: ' + key
    if (!linkq.from[key]) delete linkq.from[key]   // {cl: -1}
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
