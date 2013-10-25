/**
 * Mongosafe links: find linked records
 */

var _ = require('underscore')
var tipe = require('tipe')
var scrub = require('scrub')
var async = require('async')
var read = require('./read')

var linkTargetSpec = {
  type: 'object', strict: false, value: {
    type: 'boolean|number|object',
    comment: 'truthy scalar means get links only, object means get linked document fields',
  }
}

var linksQuerySpec = {
  init: function(v, options) {
    if (tipe.isObject(v)) {
      options.wasObject = true
      return [v]
    }
    else return v
  }
  type: 'array', value: {
    type: 'object', value: {
      to:           linkTargetSpec,  // collections document links to
      from:         linkTargetSpec,  // collections with links to document
      filter:       {type: 'object', strict: false},
      fields:       {type: 'object', default: {}, strict: false,
        value: function(v) {
          if (_.isEmpty(v)) return v
          else return _.extend(v, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1})
      }},
      limit:        read.limitSpec,
      sort:         read.sortSpec,
      docFields:    {type: 'object', strict: false},
      skip:         {type: 'number', default: 0},
      count:        {type: 'boolean', validate: function() {return 'count is NYI'}},
    },
    strict: true,
    validate: validate
  }
  finish: function(v, options) {
    if (options.wasObject) {
      delete options.wasObject
      return v[0]
    }
    else return v
  }
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
  var linkQueryIsObject = tipe.isObject(query.links)
  if (linkQueryIsObject) {
    debug('query.links is an object:', query.links)
    query.links = [query.links]
  }

  async.each(docs, getLinks, finish)

  function getLinks(doc, nextDoc) {

    doc.links = []
    async.each(query.links, getLinkq, nextDoc)

    function getLinkq(linkq, nextLinkq) {

      var result = {}
      var skipped = {to: {}, from: {}}

      debug('linkq', linkq)

      var options = {
        sort: linkq.sort,
        fields: linkq.fields,
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
        log('get from links NYI')
        finishGetLinks()
      }

      function getLinks(selector, direction, cb) {

        debug('getLinks selector', selector)
        debug('getLinks options', options)
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
            if (result.to[cl].length >= linkq.limit) {
              return getNextLink()
            }

            // Get linked Doc
            var docFields = linkq[direction][cl]
            if (tipe.isObject(docFields)) {
              db[cl].findOne({_id: link._to}, docFields, function(err, doc) {
                if (err) return cb(err)
                link.document = doc
                finishGetLink()
              })
            }
            else finishGetLink()

            function finishGetLink() {
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
