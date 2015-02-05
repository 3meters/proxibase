/**
 * Mongosafe links
 *    Read links and linked documents.
 */


var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var read = require('./read')


var linkSpec = exports.linkSpec = {
  strict: false,
  value: parse.arg,
}

var findLinksSpec = {
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
      type:        {type: 'string'},
      fields:       read.fieldSpec,
      filter:      {type: 'object', strict: false, default: {}},
      sort: {
        type: 'object|array|string',
        default: '-_id',
        value: parse.sort,
      },
      limit:        read.limitSpec,
      skip:         {type: 'number', default: 0},
      count:        {type: 'boolean'},
    },
    strict: true,
    validate: validateLinkQuery,
  },
  finish: function(v, options) {
    if (options.wasArray) {
      delete options.wasArray
      return v
    }
    else return v[0]
  },
}


// Extend the findLinksSpec with some additional properties
// for the second-level query into the linked documents
// themselves.
var findLinkedSpec = _.cloneDeep(findLinksSpec)
var extend = findLinkedSpec.value.value

extend.linkedFilter =  {type: 'object', strict: false, default: {}}
extend.linkFields = read.fieldSpec

// Add circular refrence to findLinked spec to handled nested linked queries
// Makes the spec unnserializable as JSON.
extend.linked = findLinkedSpec


/**
 * Ensure that the specified to and from links are known
 * safeCollection names.  If link.to or link.from are
 * booleans set them to {}, meaning all linked records.
 */
function validateLinkQuery(linkq, options) {
  var key, db = options.db

  if (!(linkq.from || linkq.to)) {
    return 'must specify either from or to'
  }

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

  if (linkq.count) {
    if (!_.isEmpty(linkq.linkedFilter)) return 'Link count does not support linkedFilter.'
    if (!linkq.type) return 'Link count requires type.'
    if (linkq.type.indexOf(',') >= 0) {
      return 'Link count does not support multiple types. Use an array of count queries.'
    }
  }

  if (linkq.linked && linkq.links) {
    return 'Cannot specify both links and linked'
  }
}


// Main worker
function get(collection, docs, options, cb) {

  var db = collection.db
  var doc = {}

  // Operate on single objects or recursively async map over an array of docs
  if (tipe.isObject(docs)) doc = docs
  else {
    return async.mapSeries(docs, function(doc, nextDoc) {
      get(collection, doc, options, nextDoc)
    }, cb)
  }

  var linksQuery = options.links || options.linked

  // Link queries can be a singletons or arrays.
  var linkQueryIsArray = tipe.isArray(linksQuery)
  if (!linkQueryIsArray) {
    linksQuery = [linksQuery]
  }


  async.eachSeries(linksQuery, getLinkq, function(err) {
    cb(err, doc)
  })


  // Build and run the link query
  function getLinkq(linkq, nextLinkq) {

    var results = []
    var counts = {}
    var key

    // Set up the counters
    // Note that type is required for count queries
    if (linkq.to) {
      counts.to = {}
      for (key in linkq.to) {
        counts.to[key] = {}
        counts.to[key][linkq.type] = 0
      }
    }
    if (linkq.from) {
      counts.from = {}
      for (key in linkq.from) {
        counts.from[key] = {}
        counts.from[key][linkq.type] = 0
      }
    }

    // Set up the counters
    if (linkq.to) {
      counts.to = {}
      for (key in linkq.to) {
        if (linkq.type) {
          counts.to[key] = {}
          counts.to[key][linkq.type] = 0
        }
        else counts.to[key] = 0
      }
    }
    if (linkq.from) {
      counts.from = {}
      for (key in linkq.from) {
        if (linkq.type) {
          counts.from[key] = {}
          counts.from[key][linkq.type] = 0
        }
        else counts.from[key] = 0
      }
    }

    buildToInClause()


    function buildToInClause() {
      if (!linkq.to) return buildFromInClause()
      var selector = _.extend(util.clone(linkq.filter), {_from: doc._id})
      if (linkq.type) selector.type = linkq.type
      if (!_.isEmpty(linkq.to)) {
        selector.toSchema = {$in: []}
        for (var key in linkq.to) {
           selector.toSchema.$in.push(db.safeCollection(key).schema.name)
        }
      }
      getLinksFromDb(selector, 'to', buildFromInClause)
    }


    function buildFromInClause(err) {
      if (err) return nextLinkq(err)
      if (!linkq.from) return finishLinkQuery()
      var selector = _.extend(util.clone(linkq.filter), {_to: doc._id})
      if (linkq.type) selector.type = linkq.type
      if (!_.isEmpty(linkq.from)) {
        selector.fromSchema = {$in: []}
        for (var key in linkq.from) {
          selector.fromSchema.$in.push(db.safeCollection(key).schema.name)
        }
      }
      getLinksFromDb(selector, 'from', finishLinkQuery)
    }


    function getLinksFromDb(selector, direction, cb) {

      // sort, skip, and limit only apply to the links themselves,
      // not the underlying documents
      var linkCursorOps = {
        sort: linkq.sort,
        limit: Math.min(read.config().limits.join, linkq.limit),
        skip: linkq.skip,
        batchSize: 100,
      }

      // The fields param applies to links for a links query, or linked documents for a linked query
      if (options.links && !_.isEmpty(linkq.fields)) {
        linkCursorOps.fields = _.extend(linkq.fields, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1})
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

          // Determine the collection
          var cl = ('to' === direction)
            ? db.safeSchema(link.toSchema).collection
            : db.safeSchema(link.fromSchema).collection

          // Count query
          if (linkq.count) {
            counts[direction][cl][linkq.type]++
            return nextLink()
          }

          // If called via links, rather than linked, skip the document fetch
          // and return a top level array of links
          if (!options.linked) {
            results.push(link)
            return nextLink()  // skip document fetch
          }

          // Get linked document
          // Whitelist some top-level query options that make sense for linked docs
          var linkField = ('to' === direction) ? link._to : link._from
          var docSelector = _.extend(linkq.linkedFilter, {_id: linkField})
          var findDocOps = {
            user: options.user,
            asAdmin: options.asAdmin,
            asReader: options.asReader,
            refs: options.refs,
            datesToUTC: options.datesToUTC,
          }

          // Only add field spec if it is non-empty
          if (!_.isEmpty(linkq.fields)) {
            findDocOps.fields = linkq.fields
          }

          // Find the linked doc with the linkedFilter on. If found push on results.
          db[cl].safeFindOne(docSelector, findDocOps, function(err, linkedDoc) {
            if (err) return cb(err)
            if (!linkedDoc) return nextLink()

            linkedDoc.collection = cl

            // Decide whether to add a link to the document, and if so, what fields
            // Default is add all fields.  If set to a field list, union that list
            // with the system fields.  If set to a falsy scalar, do not include
            // the link at all
            if (tipe.isUndefined(linkq.linkFields)) {
              linkedDoc.link = link
            } else if (tipe.isObject(linkq.linkFields) && !_.isEmpty(linkq.linkFields)) {
              var keys = _.union(['_id', '_to', '_from', 'type'], Object.keys(linkq.linkFields))
              linkedDoc.link = _.pick(link, keys)
            } else if (tipe.truthy(linkq.linkFields)) {
              linkedDoc.link = link
            } else {
              // linkFields was set to a falsy non-object, skip adding link to document
            }

            results.push(linkedDoc)
            nextLink()
          })
        })
      }
    }

    function finishLinkQuery(err) {
      if (err) return nextLinkq(err)

      // Recurse for nested linked queries
      if (options.linked && linkq.linked && results && results.length) {
        var linkedCl = db.safeCollection(doc.collection)
        var linkqOps = {
          user: options.user,
          asAdmin: options.asAdmin,
          asReader: options.asReader,
          refs: options.refs,
          linked: linkq.linked,
        }
        return get(linkedCl, results, linkqOps, pushLinked)
      }

      // Either counts or documents, but not both.
      // This is like mongodb but unlike /do/getEntities.
      if (linkq.count) {
        // add link counts
        doc.linkedCount = doc.linkedCount || {}
        doc.linkedCount = _.merge(doc.linkedCount, counts)
        return nextLinkq()
      }

      if (options.links) {
        doc.links = doc.links || []
        results.forEach(function(result) {
          doc.links.push(result)
        })
        return nextLinkq()
      }

      if (options.linked) pushLinked(null, results)

      function pushLinked(err, results) {
        doc.linked = doc.linked || []
        results.forEach(function(result) {
          doc.linked.push(result)
        })
        nextLinkq()
      }
    }
  }   // getLinkq
}


exports.findLinksSpec = findLinksSpec
exports.findLinkedSpec = findLinkedSpec
exports.get = get
