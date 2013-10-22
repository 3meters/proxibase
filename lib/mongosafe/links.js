/**
 * Mongosafe links: find linked records
 */

var _ = require('underscore')
var tipe = require('tipe')
var scrub = require('scrub')
var async = require('async')
var sortSpec = require('./read').sortSpec


var linksQuerySpec = {
  type: 'object|array', value: {
    type: 'object', value: {
      to:           {type: 'object', strict: false},  // collections or schemas document links to
      from:         {type: 'object', strict: false},  // collections or schemas with links to document
      filter:       {type: 'object', strict: false},
      fields:       {type: 'object', default: {}, strict: false},
      limit:        {type: 'number'},
      skip:         {type: 'number', default: 0},
      count:        {type: 'boolean', validate: function(v) {return 'Error: Count is NYI'}},
      linkFilter:   {type: 'object', strict: false},
      linkFields:   {type: 'object', strict: false},
      sort:         sortSpec,
    },
    strict: true,
    validate: validate
  }
}


/*
 * Ensure that the specified to and from links are either
 * known collection names or known schema names
 */
function validate(linkq, options) {
  if (!(linkq.from || linkq.to)) {
    return 'must specify either from or to'
  }

  var db = options.db

  // Ensure that each key in linkq.to is a known collection
  for (var key in linkq.to) {
    if (!linkq.to[key]) delete linkq.to[key]      // {cl: -1}
    else {
      if (db.safeCollection(key)) {}   // known collection, we are done
      else {
        var schema = db.safeSchema(key)
        if (schema) {
          // key is a known schema, replace it with its collection name
          linkq.to[schema.collection] = 1
          delete linkq.to[key]
        }
        else return 'Unknown schema or collection: ' + key
      }
    }
  }

  // Ensure that each key in linkq.from is a known collection
  for (var cl in linkq.from) {
    if (!linkq.from[cl]) delete linkq.from[cl]   // {cl: -1}
    else {
      if (db.safeCollection(cl)) {}   // known collection, we are done
      else {
        var schema = db.safeSchema(cl)
        if (schema) {
          // cl is a known schema, replace it with its collection name
          linkq.from[schema.collection] = 1
          delete linkq.from[cl]
        }
        else return 'Unknown schema or collection: ' + linkq.from[cl]
      }
    }
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

    async.each(query.links, getLinkq, nextDoc)

    function getLinkq(linkq, nextLinkq) {

      doc.links = doc.links || []
      var result = {}

      processTos()

      function processTos() {

        async.each(Object.keys(linkq.to), getLinkedTos, processFroms)

        // Get docs linked to this doc specfied in this link query
        function getLinkedTos(cl, nextCl) {
          result.to = result.to || {}
          result.to[cl] = []

          var schema = db.safeCollections[cl].schema.name
          var selector = linkq.linkFilter || {}
          _.extend(selector, {_from: doc._id, toSchema: schema})

          db.links.find(selector).toArray(function(err, links) {
            if (err) return nextCl(err)
            getLinkedDocs(cl, links, 'to', function(err, linkedDocs) {
              if (err) return nextCl(err)
              result.to[cl] = linkedDocs
              return nextCl()
            })
          })
        }
      }

      function processFroms(err) {
        if (err) return cb(err)
        log('get from links nyi')
        finishGetLinks()
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

      function getLinkedDocs(cl, links, direction, cb) {

        var docId, docIds = []

        links.forEach(function(link) {
          docId = ('to' === direction) ? link._to : link._from
          docIds.push(docId)
        })

        var selector = linkq.filter || {}
        _.extend(selector, {_id: {$in: docIds}})

        var options = {
          fields: linkq.fields,
          sort: linkq.sort,
          skip: linkq.skip,
          limit: linkq.limit,
        }

        db[cl].find(selector, options).toArray(function(err, linkedDocs) {
          if (err) return cb(err)
          if (!linkq.linkFields) return cb(null, linkedDocs)
          else return cb(new Error('NYI'))
          // Join back in the link fields
          linkedDocs.forEach(function(linkedDoc) {
            // add the specifed link fields to a sub object of the document
            if (linkq.linkFields) {
              if (_.isEmpty(linkq.linkFields)) {
                linkedDoc.link = link   // empty object means all fields
              }
              else {
                linkedDoc.link = {}
                for (var field in linkq.linkFields) {
                  if (linkq.linkFields[field] && tipe.isDefined(link[field])) {
                    linkedDoc.link[field] = link[field]
                  }
                }
              }
            }
          })
          cb(null, linkedDocs)
        })
      }
    }
  }

  function finish(err) {
    cb(err, docs)
  }
}

exports.get = get
exports.linksQuerySpec = linksQuerySpec
