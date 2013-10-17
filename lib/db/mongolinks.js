/**
 * Mongolinks: find linked records
 */

var _ = require('underscore')
var tipe = require('tipe')
var chk = require('chk')
var async = require('async')
var mongo = require('mongodb')
var mongoread = require('./mongoread')

var linksQuerySchema = {
  type: 'array', value: {
    type: 'object', value: {
      to:           {type: 'object', strict: false},  // collections or schemas document links to
      from:         {type: 'object', strict: false},  // collections or schemas with links to document
      linkFilter:   {type: 'object', strict: false},
      linkFields:   {type: 'object', strict: false},
      filter:       {type: 'object', strict: false},
      fields:       {type: 'object', default: {}, strict: false},
      sort:         {type: 'array',  default: [{_id: 1}]},
      limit:        {type: 'number'},
      skip:         {type: 'number', default: 0},
      count:        {type: 'boolean', validate: function(v) {return 'Error: Count is NYI'}},
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

  var collections = options.safeCollections
  var schemas = options.safeSchemas

  // Ensure that each key in linkq.to is a known collection
  for (var cl in linkq.to) {
    if (!linkq.to[cl]) delete linkq.to[cl]      // {cl: -1}
    else {
      if (collections[cl]) {}   // known collection, we are done
      else {
        if (schemas[cl]) {
          // cl is a known schema, replace it with its collection name
          linkq.to[schemas[cl].collection] = 1
          delete linkq.to[cl]
        }
        else return 'Unknown schema or collection: ' + linkq.to[cl]
      }
    }
  }

  // Ensure that each key in linkq.from is a known collection
  for (var cl in linkq.from) {
    if (!linkq.from[cl]) delete linkq.from[cl]   // {cl: -1}
    else {
      if (collections(cl)) {}   // known collection, we are done
      else {
        if (schemas[cl]) {
          // cl is a known schema, replace it with its collection name
          linkq.from[schemas[cl].collection] = 1
          delete linkq.from[cl]
        }
        else return 'Unknown schema or collection: ' + linkq.from[cl]
      }
    }
  }
}


function get(collection, query, options, docs, cb) {

  var db = collection.db
  async.each(docs, getLinks, finish)

  function getLinks(doc, nextDoc) {

    async.each(query.links, getLinkq, nextDoc)

    function getLinkq(linkq, nextLinkq) {

      doc.links = doc.links || []
      var result = {}

      // If needed, transform the mongodb console sort format
      // to the mongodb javascript driver sort format
      if (linkq.sort) linkq.sort = mongoread.formatSort(linkq.sort)
      if (tipe.isError(linkq.sort)) return cb(linkq.sort)

      processTos()

      function processTos() {

        async.each(Object.keys(linkq.to), getLinkedTos, processFroms)

        // Get docs linked to this doc specfied in this link query
        function getLinkedTos(cl, nextCl) {
          result.to = result.to || {}
          result.to[cl] = []

          var schema = db.safeCollections[cl].schema
          var selector = linkq.linkFilter || {}
          _.extend(selector, {_from: doc._id, toSchema: schema})

          db.links.find(selector).toArray(function(err, links) {
            if (err) return nextCl(err)
            var linkedDocIds = []
            links.forEach(function(link) {
              linkedDocIds.push(link._to)
            })

            getLinkedDocs(cl, linkedDocIds, function(err, linkedDocs) {
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
        nextDoc()
      }

      function getLinkedDocs(cl, ids, cb) {

        var selector = linkq.filter || {}
        _.extend(selector, {_id: {$in: ids}})

        var options = {
          fields: linkq.fields,
          sort: linkq.sort,
          skip: linkq.skip,
          limit: linkq.limit,
        }

        db[cl].find(selector, options).toArray(function(err, linkedDocs) {
          if (err) return cb(err)
          linkedDocs.forEach(function(linkedDoc) {
            if (tipe.isDefined(link.type)) linkedDoc.linkType = link.type
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
        })
      }
    }
  }

  function finish(err) {
    cb(err, docs)
  }
}

exports.get = get
exports.linksQuerySchema = linksQuerySchema
