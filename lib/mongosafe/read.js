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
    validate: checkLinkQuery
  },
  finish: function(v, options) {
    if (options.wasArray) {
      delete options.wasArray
      return v
    }
    else return v[0]
  },
}

var _safeFindSpec = {
  query:      {type: 'object', strict: false},  // mongodb pass-through query clause
  fields:     fieldSpec,
  count:      {type: 'boolean'},
  genId:      {type: 'boolean'},
  countBy:    {type: 'array', value: {type: 'string'}},
  skip:       {type: 'number'},
  limit:      limitSpec,
  refs:       {type: 'boolean|string|object|number'},
  datesToUTC: {type: 'boolean'},
  sort:       sortSpec,
  links:      linksQuerySpec,
  log:        {type: 'boolean'},
  user:       {type: 'object', value: {
    _id: {type: 'string', required: true},
    role: {type: 'string', required: true},
  }}
}


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
  mongo.Db.prototype.safeFindSpec = safeFindSpec

  return mongo
}


function safeFind(query, options, cb) {

  var err = parse.args(arguments)
  query = arguments[0]
  options = arguments[1]
  cb = arguments[2]
  if (err) return cb(err)

  var collection = this
  var selector = query.query || query || {}

  validate(collection, query, options, function(err, query, options) {
    if (err) return cb(err)

    var originalLimit = options.limit

    // Limit = 1 usually means a cursor walk, leave alone
    if (options.limit > 1) options.limit++

    if (options.log) log('safeFind query on ' + collection.collectionName + ':', selector)
    if (options.log) log('safeFind options:', options)

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
          cb(null, count)
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
      if (docs.length > originalLimit) {
        docs.pop()
        more = true
      }

      // restore original limit
      options.limit = originalLimit

      decorate(collection, docs, options, function(err, docs) {
        if (err) return cb(err)

        var meta = {count: docs.length, more: more}
        var after = collection.schema.after.read

        if (!after) return cb(null, docs, meta)

        var scope = {
          docs: docs,
          more: more,
          options: options,
        }
        after.call(collection, null, scope, cb)
      })
    }
  })
}


// safeFindOne
function safeFindOne(query, options, cb) {

  var err = parse.args(arguments)
  if (!tipe.isFunction(cb)) cb = logErr
  if (err) return cb(err)

  var collection = this

  validate(collection, query, options, function(err, query, options) {

    if (err) return cb(err)

    if (options.log) log('safeFindOne query on ' + collection.collectionName + ':', query)
    if (options.log) log('safeFindOne options:', options)

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

          var after = collection.schema.after.read

          if (!after) return cb(null, doc, {count: 1})

          var scope = {
            doc: doc,
            options: options,
          }
          after.call(collection, null, scope, cb)
        })
      }
    })
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
    cb(null, docs[0])
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

        if (!docs.length) return cb(null, count)      // done

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


// Informational method describing the options spec
function safeFindSpec() {
  return _safeFindSpec
}


// Validate the collection, scrub the options, then run the schema read
// befores. Return potentially modified query and options on success
function validate(collection, query, options, cb) {

  if (!collection.schema) return cb(new Error('Unknown collection ' + collection.collectionName))

  var err = scrub(options, _safeFindSpec, {db: collection.db})
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

  // Link queries can be a singletons or arrays.
  // Results are returned in matching format.
  var linkQueryIsArray = tipe.isArray(options.links)
  if (!linkQueryIsArray) {
    options.links = [options.links]
  }

  doc.links = []

  async.eachSeries(options.links, getLinkq, function(err) {
    cb(err, doc)
  })

  function getLinkq(linkq, nextLinkq) {

    var result = {}

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

      // sort, skip, and limit only apply to the links themselves,
      // not the underlying documents
      var linkCursorOps = {
        sort: linkq.sort,
        limit: Math.min(config().limits.join, linkq.limit),
        skip: linkq.skip,
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
            if (err) {
              if (err.code === 'badAuth') return nextLink()  // user doesn't have permissions to read doc, continue
              else return cb(err)
            }
            if (linkedDoc) keep(link, linkedDoc)
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
        _config.limits.join + '. Restrict your query further and try again.'))
  }

  var refs = collection.schema.refs

  // Check the args
  var refQuery = parse.arg(options.refs)
  if (tipe.isError(refQuery)) return cb(refQuery)
  if (!(tipe.isBoolean(refQuery) || tipe.isObject(refQuery))) {
    return cb(perr.serverError('Could not parse refs query', options.refs))
  }

  // Build a map of refs to look up
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
         *
         *  1. refs is truthy, e.g. true or on or 1,
         *     the entire ref doc is nested
         *  2. refs is a string naming just one field, e.g. refs=name,
         *     the value of that field alone is promoted to the outer doc
         *  3. refs is a comma-separated list of field names, e.g. refs=_id,name,role,
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
            for (var qryField in refQuery) {
              if (refDoc[qryField]) doc[refFieldName][qryField] = refDoc[qryField]
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

/**
 * Ensure that the specified to and from links are known
 * safeCollection names.  If link.to or link.from are
 * booleans set them to {}, meaning all linked records.
 */
function checkLinkQuery(linkq, options) {
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
