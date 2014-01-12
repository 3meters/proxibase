/**
 * Mongosafe links: find linked records
 */

var _ = require('underscore')
var tipe = require('tipe')
var scrub = require('scrub')
var async = require('async')
var read = require('./read')

var linksQuerySpec = {
  init: function(v, options) {
    if (tipe.isObject(v)) {
      options.wasObject = true
      return [v]
    }
    else return v
  },
  type: 'array', value: {
    type: 'object', value: {
      to:         {type: 'object', strict: false},  // collections document links to
      from:       {type: 'object', strict: false},  // collections with links to document
      filter:     {type: 'object', strict: false},
      fields:     {type: 'object', strict: false},
      docFields:  {type: 'object', strict: false},
      limit:      read.limitSpec,
      sort:       read.sortSpec,
      skip:       {type: 'number', default: 0},
      count:      {type: 'boolean', validate: function() {return 'count is NYI'}},
    },
    strict: true,
    validate: validate
  },
  finish: function(v, options) {
    if (options.wasObject) {
      delete options.wasObject
      return v[0]
    }
    else return v
  },
}

/*
 * Ensure that the specified to and from links are
 * known safeCollection names
 */
function validate(linkq, options) {
  var db = options.db

  if (!(linkq.from || linkq.to)) return 'must specify either from or to'

  for (var key in linkq.to) {
    if (!db.safeCollection(key)) return 'Unknown collection: ' + key
    if (!linkq.to[key]) delete linkq.to[key]      // {cl: -1}
  }

  for (var key in linkq.from) {
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
  var linkQueryIsObject = tipe.isObject(options.links)
  if (linkQueryIsObject) {
    options.links = [options.links]
  }

  async.each(docs, getLinks, finish)

  function getLinks(doc, nextDoc) {

    doc.links = []
    async.each(options.links, getLinkq, nextDoc)

    function getLinkq(linkq, nextLinkq) {

      var result = {}
      var skipped = {to: {}, from: {}}

      var options = {
        sort: linkq.sort,
        limit: read.config().limits.max,
      }

      getToLinks()

      function getToLinks() {
        if (!linkq.to) return getFromLinks()
        result.to = {}
        var selector = linkq.filter || {}
        _.extend(selector, {_from: doc._id})
        if (!_.isEmpty(linkq.to)) {
          selector.toSchema = {$in: []}
          for (var key in linkq.to) {
            result.to[key] = []  // put result in the order specified
            selector.toSchema.$in.push(db.safeCollection(key).schema.name)
          }
        }
        getLinks(selector, 'to', getFromLinks)
      }

      function getFromLinks(err) {
        if (err) return cb(err)
        if (!linkq.from) return finishGetLinks()
        result.from = {}
        var selector = linkq.filter || {}
        _.extend(selector, {_to: doc._id})
        if (!_.isEmpty(linkq.from)) {
          selector.fromSchema = {$in: []}
          for (var key in linkq.from) {
            result.from[key] = []  // put result in the order specified
            selector.fromSchema.$in.push(db.safeCollection(key).schema.name)
          }
        }
        getLinks(selector, 'from', finishGetLinks)
      }

      function getLinks(selector, direction, cb) {

        var cursor = db.links.find(selector, options)
        getNextLink()

        function getNextLink() {
          cursor.nextObject(function(err, link) {
            if (err) return cb(err)
            if (!link) return cb() // finished
            var cl = ('to' === direction)
              ? db.safeSchema(link.toSchema).collection
              : db.safeSchema(link.fromSchema).collection

            result[direction][cl] = result[direction][cl] || []

            // Skip
            if (linkq.skip) {
              skipped[direction][cl] = skipped[direction][cl] || 0
              if (skipped[direction][cl] < linkq.skip) {
                skipped[direction][cl]++
                return getNextLink()
              }
            }

            // Limit
            if (result[direction][cl].length >= linkq.limit) {
              return getNextLink()
            }

            // Get linked doc.  doc fields can be spcified at the options
            // level and overriden at the [direction][collection] level
            var docFields = linkq.docFields
            if (tipe.isDefined(linkq[direction][cl])) docFields = linkq[direction][cl]
            if (tipe.isObject(docFields) || tipe.isArray(docFields)) {
              var linkField = ('to' === direction) ? link._to : link._from
              db[cl].findOne({_id: linkField}, docFields, function(err, doc) {
                if (err) return cb(err)
                link.document = doc
                finishGetLink()
              })
            }
            else finishGetLink()

            function finishGetLink() {
              if (linkq.fields && !_.isEmpty(linkq.fields)) {
                for (var field in link) {
                  if ('_id' === field) continue
                  if (!(linkq.fields[field])) delete link[field]
                }
              }
              result[direction][cl].push(link)
              getNextLink()
            }
          })
        }
      }

      function finishGetLinks(err) {
        if (err) return cb(err)
        doc.links.push(result)
        if (linkQueryIsObject) {
          if (1 !== doc.links.length) {
            var err = new Error('Expected doc.links to have one element')
            err.details = doc.links
            return nextDoc(err)
          }
          doc.links = doc.links[0]
        }
        nextDoc()
      }
    }   // getLinks
  }     // getDoc

  function finish(err) {
    cb(err, docs)
  }
}

exports.get = get
exports.linksQuerySpec = linksQuerySpec
