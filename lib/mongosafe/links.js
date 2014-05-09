/**
 * Mongosafe links: find linked records
 */

var _ = require('underscore')   // jshint ignore:line
var tipe = require('tipe')      // jshint ignore:line
var async = require('async')
var read = require('./read')

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
      to:           read.linkSpec,  // collections document links to
      from:         read.linkSpec,  // collections with links to document
      fields:       read.fieldSpec,
      filter:       {type: 'object', strict: false, default: {}},
      linkFilter:   {type: 'object', strict: false, default: {}},
      linkFields:   read.fieldSpec,
      limit:        read.limitSpec,
      sort: {
        type: 'object|array|string',
        default: '-_id',
        value: read.formatSort,
      },
      skip:         {type: 'number', default: 0},
      noDocuments:  {type: 'boolean'},
      outer:        {type: 'boolean'},
      count:        {type: 'boolean'},
    },
    strict: true,
    validate: validate
  },
  finish: function(v, options) {
    if (options.wasArray) {
      delete options.wasArray
      return v
    }
    else return v[0]
  },
}

/*
 * Ensure that the specified to and from links are
 * known safeCollection names
 * if link.to or link.from are booleans set them to {}, meaning all linked records
 */
function validate(linkq, options) {
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


function get(collection, query, options, docs, cb) {

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

  async.eachSeries(docs, getLinked, finish)

  function getLinked(doc, nextDoc) {

    doc.links = []

    async.eachSeries(options.links, getLinkq, nextDoc)

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
          limit: read.config().limits.join,
        }

        var cursor = db.links.find(selector, linkCursorOps)
        nextLink()

        function nextLink() {
          cursor.nextObject(function(err, link) {
            if (err || !link) {
              cursor.close()
              return cb(err)
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

            // Skip
            if (linkq.skip) {
              skipped[direction][cl] = skipped[direction][cl] || 0
              if (skipped[direction][cl] < linkq.skip) {
                skipped[direction][cl]++
                return nextLink()
              }
            }

            // Limit
            if (result[direction][cl].length >= linkq.limit) {
              return nextLink()
            }

            // Get linked doc
            // Whitelist some top-level query options that make sense for linked docs
            if (!linkq.noDocuments) {
              var linkField = ('to' === direction) ? link._to : link._from
              var docSelector = _.extend(linkq.filter, {_id: linkField})
              var findDocOps = {
                user: options.user,
                fields: linkq.fields,
                refs: options.refs,
                datesToUTC: options.datesToUTC,
              }
              db[cl].safeFindOne(docSelector, findDocOps, function(err, doc) {
                // don't fail on errors, just skip, can be lack of read perms
                if (err) return finishGetLink(false)
                if (doc) {
                  link.document = doc
                  finishGetLink(true)
                }
                else finishGetLink(false)
              })
            }
            else finishGetLink(true)

            function finishGetLink(keep) {
              if (keep) {
                if (!_.isEmpty(linkq.linkFields)) {
                  for (var field in link) {
                    if ('document' === field) continue
                    if ('_id' === field) continue
                    if (!linkq.linkFields[field]) delete link[field]
                  }
                }
                result[direction][cl].push(link)
                nextLink()
              }
              else {
                // doc failed link filter
                if (!linkq.outer) doc.removeDoc = true
                nextDoc()
              }
            }
          })
        }
      }

      function finishLinkQuery(err) {
        if (err) return nextLinkq(err)
        if (!doc.cLinks && !linkq.outer) doc.removeDoc = true // failed filter on inner join
        if (!doc.removeDoc) {
          doc.links.push(result)
          // Convert single element array back to object
          if (!linkQueryIsArray) doc.links = doc.links[0]
        }
        nextLinkq()
      }
    }   // getLinks
  }     // getDoc

  function finish(err) {
    var newDocs = []
    docs.forEach(function(doc) {
      if (!doc.removeDoc) {
        delete doc.cLinks
        newDocs.push(doc)
      }
    })
    cb(err, newDocs)
  }
}

exports.get = get
exports.linksQuerySpec = linksQuerySpec
