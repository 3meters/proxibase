/**
 * Mongoread: extend mongodb native to provide find sugar
 */

var util = require('proxutils')
var tipe = require('tipe')
var statics = util.statics
var async = require('async')
var mongo = require('mongodb')
var Collection = mongo.Collection


function extendMongodb() {

  Collection.prototype.safeFind =
  function(query, cb) {
    if (!this.schema) {
      // Not known to us, pass through unmodified to native find
      return Collection.prototype.find.call(this, query)
        .toArray(function(err, docs) {
          cb(err, {data: docs})  // for symetry with safeFind return signiture
        })
    }
    var err = checkArgs(query)
    if (err) return cb(err)
    safeFind(this, query, cb)
  }

  Collection.prototype.safeFindOne =
  function (query, cb) {
    query.limit = 1
    Collection.prototype.safeFind.call(this, query, cb)
  }

}


/**
 * check arguments
 *
 * @args[0] query object, required
 * @args[1] cb function, optional
 */
function checkArgs(query, idRequired) {

  var _query = {
    ids:        {type: 'array'},
    name:       {type: 'string'},
    find:       {type: 'array'},
    fields:     {type: 'array'},
    sort:       {type: 'object'},
    count:      {type: 'number'},
    countBy:    {type: 'array'},
    skip:       {type: 'number'},
    limit:      {type: 'number', default: statics.optionsLimitDefault},
    links:      {type: 'array', value: _linkQuery},
    lookups:    {type: 'boolean'},
    datesToUTC: {type: 'boolean'},
  }

  var _linkQuery = {
    collection:   {type: 'string', required: true},
    direction:    {type: 'string', required: true, value: 'to|from'},
    linkType:     {type: 'string'},
    as:           {type: 'string'},
    fields:       {type: 'array'},
    limit:        {type: 'number'},
    includeLink:  {type: 'boolean'},
  }

  var err = util.check(query, _query)
  if (err) return err
  return null
}


function safeFind(collection, query, cb) {

  var db = collection.db
  var selector = {}
  var options = {}
  var queryLimit = statics.limitDefault

  selector = query.find || {}
  if (tipe.isArray(query.ids)) {
    selector._id = {$in: query.ids}
  }

  if (query.name) selector.namelc = new RegExp('^' + query.name.toLowerCase())

  queryLimit = Math.min(statics.limitMax, parseInt(query.limit))
  options.limit = queryLimit + 1 // cheap trick

  // whitelist valid options
  if (query.fields) options.fields = query.fields
  if (query.skip) options.skip = query.skip

  // For some reason the javascript driver wants the sort
  // specified in a different format than the mongo console.
  // We support the mongo console format, and convert it to
  // what the driver wants
  if (query.sort) {
    options.sort = []
    Object.keys(query.sort).forEach(function(key) {
      if (tipe.isTruthy(query.sort[key])) options.sort.push([key, 'asc'])
      else options.sort.push([key, 'desc'])
    })
  }


  // Count
  if (tipe.isTruthy(query.count)) {
    return collection.find(selector, options)
      .count(function process(err, count) {
        if (err) return cb(err)
        cb(null, {count:count})
      })
  }

  // CountBy
  if (query.countBy) return aggregateBy(selector, 'countBy', query.countBy)

  // Regular find
  return collection.find(selector, options).toArray(getLinkedDocuments)

  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(selector, agg, groupOn) {

    // Make sure all the groupOn fields are in the schema
    var badFields = groupOn.filter(function(field) {
      return !collection.schema.fields[field]
    })
    if (badFields.length) return cb(perr.badParam(badFields))

    switch(agg) {
      case 'countBy':
        var map = function() {
          var self = this
          var id = {}
          groupOn.forEach(function(field) {
            id[field] = self[field]
          })
          emit(id, 1)
        }
        var reduce = function(key, vals) {
          var count = 0
          vals.forEach(function(val) { count+= val })
          return count
        }
        break
      default:
        return cb(new Error('Invalid call to aggregateBy'))
    }
    var options = {
      query: selector,
      scope: {groupOn: groupOn}, // local vars passed to mongodb
      out: {inline: 1}
    }
    collection.mapReduce(map, reduce, options, function(err, docs) {
      if (err) return cb(err)
      var results = []
      docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
      // mongo returns very generic looking results from map reduce operations
      // transform those results back into the terms of the original query
      docs.forEach(function(doc) {
        var result = {}
        groupOn.forEach(function(field) {
          result[field] = doc._id[field]
        })
        result[agg] = doc.value
        results.push(result)
      })
      return processResults(null, results)
    })
  }


  /*
   * Get the linked documents
   */
  function getLinkedDocuments(err, docs) {
    if (err) return cb(err)

    if (!(query.links && query.links.length)) {
      return validate(err, docs)
    }

    async.forEach(docs, getLinks, finish)

    function getLinks(doc, nextDoc) {

      async.forEach(query.links, getIds, nextDoc)

      function getIds(linkq, nextLinkq) {
        if (!db.collection(linkq.collection)) {
          return nextLinkq(perr.badValue(linkq.collection))
        }

        // name the linked collection will be given under each parent doc
        if (!linkq.as) {
          linkq.as = linkq.direction + '_' + linkq.collection
          linkq.as += linkq.linkType
            ? '_' + linkq.linkType
            : ''
        }

        var collectionId = statics.collectionIds[linkq.collection]

        var selector = {}
        if ('to' === linkq.direction) {
          selector = {
            _from: doc._id,
            toCollectionId: collectionId,
          }
        }
        else {
          selector = {
            _to: doc._id,
            fromCollectionId: collectionId,
          }
        }
        if (linkq.linkType) selector.type = linkq.linkType

        var options = {
          limit: Math.min(statics.limitMax, linkq.limit || queryLimit),
          sort: ['_id', 'desc'],
        }

        db.links.find(selector, options).toArray(function(err, links) {
          if (err) return nextLinkq(err)
          if (!(links && links.length)) return nextLinkq()

          // We anticipate some results
          doc[linkq.as] = []
          async.forEach(links, getLinkedDoc, nextLinkq)

          function getLinkedDoc(link, nextLinkedDoc) {

            // Get each linked doc
            var selector = {
              _id: ('to' === linkq.direction)
                ? link._to
                : link._from
            }

            var options = {}
            if (linkq.fields) options.fields = linkq.fields

            db[linkq.collection].findOne(selector, options, function(err, linkedDoc) {
              if (err) return nextLinkedDoc(err)
              if (link.type) linkedDoc.linkType = link.type
              if (linkq.includeLink) linkedDoc.link = link
              doc[linkq.as].push(linkedDoc)
              nextLinkedDoc()
            })
          }
        })
      }
    }

    function finish(err) {
      validate(err, docs)
    }
  }


  /*
   * Run the read validators on the query results.  These can be used to create
   * calculated fields
   */
  function validate(err, docs) { // Options for symetry with write validators?
    if (err) return cb(err)

    var validators = collection.schema.validators
    if (!(validators && validators.read)) return processResults(err, docs)

    // validators.read is an array of validator functions
    async.eachSeries(validators.read, validateDocs, function(err) {
      processResults(err, docs)
    })

    function validateDocs(validator, next) {
      // TODO: perf test this against each & eachLimit
      async.eachLimit(docs, 10, validateDoc, next)
      function validateDoc(doc, next) {
        validator.call(collection, doc, null, null, next) // doc, previous, options, cb
      }
    }
  }


  /*
   * getLookups: populate refs (aka foreign keys) with the name property
   *   of the referenced collection
   *
   * @docs  array of documents
   * @refs  boolean or object.  If boolean lookup value from the schema of
   *        the collection otherwise {field:collection}
   * @cb    cb
   */
  function getLookups(docs, refs, cb) {

    if (!refs) return cb(docs)
    if (typeof refs !== 'object') refs = _.clone(collection.schema.refs)
    var parents = {} // map of parent collections, often only one: users
    var refNames = {}  // name of property looked-up value will be stored in
    for (field in refs) {
      parents[refs[field]] = true
      refNames[field] = field === '_id'
        ? 'name'           // self join
        : field.slice(1)   // e.g. _owner => owner
    }

    // For each lookup table, even if several fields point to the same table
    async.forEach(Object.keys(parents), lookupValues, finish)

    // Make a map of all the unique _ids to be looked up
    function lookupValues(parent, next) {
      var valMap = {}
      docs.forEach(function(doc) {
        for (var field in refs) {
          if (doc[field]) valMap[doc[field]] = null
        }
      })

      // Convert to an ordered array for passing to mongodb find $in
      var vals = Object.keys(valMap).sort()

      // Look up the cooresponding name properties
      db.collection(parent).find({_id: {$in: vals}, name: /.*/}, {name: 1})
        .toArray(function(err, lookups) {
          if (err) return next(err)
          lookups.forEach(function(lookup) {
            valMap[lookup._id] = lookup.name  // add the name to valMap
          })
          // graft back in the names into the original documents array
          docs.forEach(function(doc) {
            for (field in refs) {
              var val = valMap[doc[field]]
              if (val) doc[refNames[field]] = val  // e.g. doc.owner = george
            }
          })
          next()
        })
    }

    // Delete the lookups property from the request's query and call back
    function finish(err) {
      delete query.lookups
      cb(err, docs)
    }
  }


  function processResults(err, docs) {

    if (err) return cb(err)

    var lookups = query.lookups
    if (lookups) return getLookups(docs, lookups, processResults)
    var more = false
    if (docs.length > queryLimit) {
      docs.pop()
      more = true
    }
    if (tipe.isTruthy(query.datesToUTC)) {
      docs.forEach(function(doc) {
        for (var fieldName in doc) {
          if ((fieldName.indexOf('Date') >= 0) &&
               tipe.isNumber(doc[fieldName])) {
            doc[fieldName] = new Date(doc[fieldName]).toUTCString()
          }
        }
      })
    }
    var body = {
      data: docs,
      count: docs.length,
      more: more
    }
    return cb(null, body)
  }
}

extendMongodb()  // runs on require
