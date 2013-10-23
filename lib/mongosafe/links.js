/**
 * Mongosafe links: find linked records
 */

var _ = require('underscore')
var tipe = require('tipe')
var scrub = require('scrub')
var async = require('async')
var sortSpec = require('./read').sortSpec
var limits = require('./read').limits


var linksQuerySpec = {
  type: 'object|array', value: {
    type: 'object', value: {
      to:           {type: 'object', strict: false},  // collections document links to
      from:         {type: 'object', strict: false},  // collections with links to document
      filter:       {type: 'object', strict: false},
      fields:       {type: 'object', default: {}, strict: false,
        value: function(v) {
          if (_.isEmpty(v)) return v
          else return _.extend(v, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1})
      }},
      limit:        {type: 'number'},                 // limit links per schema, not total
      sort:         sortSpec,
      docFields:    {type: 'object', strict: false},
      skip:         {type: 'number', default: 0},
      count:        {type: 'boolean', validate: function() {return 'count is NYI'}},
    },
    strict: true,
    validate: validate
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
  if (linkQueryIsObject) query.links = [query.links]

  async.each(docs, getLinks, finish)

  function getLinks(doc, nextDoc) {

    doc.links = []
    async.each(query.links, getLinkq, nextDoc)

    function getLinkq(linkq, nextLinkq) {

      var result = {}
      var skipped = {to: {}, from: {}}

      var options = {
        sort: linkq.sort,
        fields: linkq.fields,
        limit: limits.max,
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
        debug('toLinkSelector', selector)
        getLinks(selector, 'to', getFromLinks)
      }

      function getFromLinks(err) {
        if (err) return cb(err)
        log('get from links NYI')
        finishGetLinks()
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
              skipped[direction][cl] = skippied[direction][cl] || 0
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
            if (linkq.docFields) {
              db[cl].findOne({_id: link._to}, linkq.docFields), function(err, doc) {
                if (err) return cb(err)
                link.doc = doc
                getNextLink()
              }
            }
            else getNextLink()
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
