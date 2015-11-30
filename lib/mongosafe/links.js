/**
 * Mongosafe links
 *    Read links and linked documents.
 */


var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var read = require('./read')


// Default to most recent
var linkSortSpec = {
  type: 'object|array|string',
  default: '-modifiedDate',
  value: parse.sort,
}


// linkCounts spec
var linkCountsSpec = {
  type: 'array', value: {
    type: 'object', value: {
      to:       {type: 'string'},
      from:     {type: 'string'},
      type:     {type: 'string', required: true},
      enabled:  {type: 'boolean'},
      filter:   {type: 'object', strict: false, default: {}},
      tag:      {type: 'string'},
    },
    strict: true,
    validate: validateLinkQuery,
  }
}


// Links spec
var linksSpec = {
  type: 'array', value: {
    type: 'object', value: {
      to:           {type: 'string'},  // collection name
      from:         {type: 'string'},  // collection name
      type:         {type: 'string', required: true, validate: validateType},
      enabled:      {type: 'boolean'},
      fields:       read.fieldSpec,
      linkFields:   read.fieldSpec,
      filter:       {type: 'object', strict: false},
      sort:         linkSortSpec,
      limit:        read.limitSpec,
      more:         {type: 'boolean'},
      skip:         {type: 'number'},
      refs:         {type: 'boolean|string|object|number', strict: false}, // TODO: get from refs module
      tag:          {type: 'string'},
    },
    strict: true,
    validate: validateLinkQuery,
  },
}


// Extend the LinkedSpec with some additional properties for
// the next-level link queries into the linked documents themselves.
var linkedSpec = _.cloneDeep(linksSpec)
var linkedProps = {
  linkedFilter: {type: 'object', strict: false, default: {}},
  linkFields:   read.fieldSpec,
  linked:       {type: 'object|array', strict: false},
  links:        {type: 'object|array', strict: false},
  linkCount:    {type: 'object|array', strict: false, deprecated: true},
  linkCounts:   {type: 'object|array', strict: false},
}

delete linkedProps.linkFields.default    // default to undefined, not object
linkedSpec.value.value = _.assign(linkedSpec.value.value, linkedProps)


// Map the specs
var specs = {
  linkCounts: linkCountsSpec,
  linkCount:  linkCountsSpec,
  links:      linksSpec,
  linked:     linkedSpec,
}


// We don't support comma-delimeted types, unlike elsewhere
function validateType(v) {
  if (v.match(/\,/)) {
    return 'Link queries do not support multiple types. Use an array of link queries.'
  }
}


// Ensure that the either a from collection or a to
// collection is specified, but not both, and that
// the collection name is valid
function validateLinkQuery(linkq, options) {

  if (!(linkq.from || linkq.to)) {
    return 'must specify either from collection or to collection'
  }
  if (linkq.from && linkq.to) {
    return 'cannot specifiy both to collection and from collection in one link query'
  }
  if (linkq.to && !options.safeCls[linkq.to]) {
    return 'Unknown collection: ' + linkq.to
  }
  if (linkq.from && !options.safeCls[linkq.from]) {
    return 'Unknown collection: ' + linkq.from
  }
}


// Main worker
function get(collection, docs, options, cb) {

  var db = collection.db

  var config = read.config()  // util.config.db

  // Docs can be an object or an array of objects
  if (tipe.isObject(docs)) {
    docs = [docs]
    options.docsWasObject = true
  }

  // Backwards compat mapping deprecated method
  if (options.linkCount && !options.linkCounts) {
    options.linkCounts = options.linkCount
  }
  delete options.linkCount

  // Make an array of doc ids
  var docIds = []
  docs.forEach(function(doc) { docIds.push(doc._id) })

  // Process link query options in order
  async.eachSeries(['linkCounts', 'links', 'linked'], getLinkOpts, finish)


  // Get results for linkCounts, link, or linked queries, each of which can be an array
  function getLinkOpts(linkOpt, nextLinkOpt) {

    var linkQueries = options[linkOpt]
    if (!linkQueries) return nextLinkOpt()

    // Link queries can be objects or arrays of objects
    if (_.isPlainObject(linkQueries)) {
      linkQueries = [linkQueries]
    }

    // Scrub each query as needed
    var err = scrub(linkQueries, specs[linkOpt], {strict: true, safeCls: db.safeCollectionNames})
    if (err) return cb(err)

    //
    // TODO: PERF: In some cases I suspect that linkOpt queries can be combined and sent to
    // the db more efficiently.  Consider sending the array of each linkOpt queries to functions
    // to process separately
    //
    async.eachSeries(linkQueries, getLinkq, nextLinkOpt)

    // Build and run each link query
    function getLinkq(linkq, nextLinkq) {

      var selector                // selector query to be passed to db
      var dirTo                   // Direction to or from
      var direction               // scruf
      var clName

      // Build the link selector
      if (linkq.to) {
        dirTo = true
        direction = 'to'
        clName = linkq.to
        selector = {toSchema: db.safeCollection(linkq.to).schema.name}
      }
      else {
        dirTo = false
        direction = 'from'
        clName = linkq.from
        selector = {fromSchema: db.safeCollection(linkq.from).schema.name}
      }

      if (linkq.type) selector.type = linkq.type
      if (tipe.isDefined(linkq.enabled)) selector.enabled = linkq.enabled

      // Optional filter.  Ignore the _to or _from if set
      if (!_.isEmpty(linkq.filter)) {
        if (dirTo) delete linkq.filter._from
        else delete linkq.filter._from
        _.assign(selector, linkq.filter)
      }

      // Converts $in clauses with single targets into simple property checks
      // eg:  _to: {$in: [us.adminId]} becomes _to: us.adminId
      // This code should live inside mongodb, but as of version 3.6 does not.
      read.optimizeSelector(selector)

      // Get either the counts or the links
      if (linkOpt === 'linkCounts') {
        return getLinkCountsFromDb()
      }
      else {
        return getLinksFromDb()
      }


      // Use the aggreation framework to bulk count the links to all documents
      // TODO: PERF:  We should aggregate these stats live, possibly in a separate
      // db, and query them directly.
      function getLinkCountsFromDb() {

        var match = dirTo ? {_from: {$in: docIds}} : {_to: {$in: docIds}}
        _.assign(match, selector)

        // Define the mongodb aggreation framework group clause
        var group = {
          _id: dirTo ? '$_from' : '$_to',
          schema: {$first: dirTo ? '$toSchema' : '$fromSchema'},
          type: {$first: '$type'},
          count: {$sum: 1},
        }

        var timer = util.timer()

        var aggQuery = [{$match: match}, {$group: group}]
        db.links.aggregate(aggQuery, function(err, aggs) {
          if (err) return finish(err)

          logPerf(aggQuery, aggs.length, timer.read())

          // old return signiture
          var oldResultMap = {}
          var oldResultTemplate = {}
          oldResultTemplate[direction] = {}
          oldResultTemplate[direction][clName] = {}
          oldResultTemplate[direction][clName][linkq.type] = 0

          // new return signiture
          var resultMap = {}
          var resultTemplate = _.cloneDeep(linkq)
          if (_.isEmpty(resultTemplate.filter)) delete resultTemplate.filter
          resultTemplate.count = 0

          // Make a map of the results by doc id in the shape we like
          aggs.forEach(function(agg) {
            // deprecated signature
            var oldResult = _.cloneDeep(oldResultTemplate)
            oldResult[direction][clName][agg.type] = agg.count
            oldResultMap[agg._id] = oldResult
            // new signature
            var result = _.cloneDeep(resultTemplate)
            result.count = agg.count
            resultMap[agg._id] = result
          })

          // Graft the link count results into each doc
          docs.forEach(function(doc) {
            // Deprecated
            doc.linkCount = doc.linkCount || {}
            if (oldResultMap[doc._id]) _.merge(doc.linkCount, oldResultMap[doc._id])
            else _.merge(doc.linkCount, oldResultTemplate)   // count of zero

            // Current
            doc.linkCounts = doc.linkCounts || []
            if (resultMap[doc._id]) doc.linkCounts.push(resultMap[doc._id])
            else doc.linkCounts.push(resultTemplate)   // count of zero
          })

          nextLinkq()
        })
      }


      // LinkOpt is links or linked.  First get the links
      function getLinksFromDb() {

        // Sort, skip, and limit only apply to the links themselves,
        // not the underlying documents
        var linkOps = {
          sort: linkq.sort,
          limit: Math.min(linkq.limit, config.limits.join, 1000),   // results will be loaded into memory
          skip: linkq.skip || 0,
        }
        if (linkOps.limit < 0) linkOps.limit = 50   // caller set limit below zero

        // Check for more records
        if (linkq.more) linkOps.limit++

        // The fields param applies to the links for a links query or to the linked documents for a linked query
        if (options.links && !_.isEmpty(linkq.fields)) {
          linkOps.fields = _.extend(linkq.fields, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1, type: 1})
        }

        async.eachSeries(docs, getLinksForDoc, nextLinkq)

        function getLinksForDoc(doc, nextDoc) {

          if (linkOpt === 'links') doc.links = doc.links || []
          else doc.linked = doc.linked || []

          var linksForDocSelector = dirTo ? {_from: doc._id} : {_to: doc._id}
          _.assign(linksForDocSelector, selector)

          var timer = util.timer()
          db.links.find(linksForDocSelector, linkOps).toArray(function(err, links) {
            if (err) return finish(err)

            var cLinks = (links && links.length) || 0
            logPerf(linksForDocSelector, cLinks, timer.read())
            if (!cLinks) return nextDoc()

            // If asked by the links.more query bit, tell the caller if there are more
            // links that would be satisfied by the query but were not returned.
            var more = false
            if (linkq.more)  {
              if (links.length >= linkOps.limit) {
                more = true
                links.pop()   // We asked for one more link than than the limit, discard it.
              }
            }

            if (linkOpt === 'links') {
              if (linkq.more) doc.moreLinks = doc.moreLinks || more || false
              links.forEach(function(link) {
                doc.links.push(link)
              })
              return nextDoc()
            }
            getLinkedDocsForDoc(doc, links, more, nextDoc)
          })    // find links
        }       // getLinksForDoc
      }         // getLinksFromDb


      function getLinkedDocsForDoc(doc, links, more, cb) {

        var linked = []
        var linkMap = {}
        var docIds = []
        links.forEach(function(link) {
          var docId = dirTo ? link._to : link._from
          docIds.push(docId)
          linkMap[docId] = link
        })

        // Get linked documents
        var docsSelector = _.cloneDeep(linkq.linkedFilter)

        // Whitelist some top-level query options that make sense for linked docs
        var findDocsOps = _.pick(_.cloneDeep(options), ['user', 'asAdmin', 'asReader', 'refs', 'utc', 'tag'])
        _.assign(findDocsOps, _.pick(linkq, ['refs', 'fields']))

        // Find the linked docs with the linkedFilter on. If found push on results.
        // Fast find
        if (options.asReader || db[clName].schema.public || linkq.limit === 1) {
          _.assign(docsSelector, {_id: {$in: docIds}})
          return db[clName].safeFind(docsSelector, findDocsOps, processLinked)
        }
        else {
          // Slow secure find One
          return async.eachSeries(docIds, getLinkedDoc, function(err) {
            if (err) return finish(err)
            processLinked(null, linked)
          })
        }

        function getLinkedDoc(_id, nextDoc) {
          db[clName].safeFindOne({_id: _id}, findDocsOps, function(err, linkedDoc) {
            if (err) return finish(err)
            if (linkedDoc) linked.push(linkedDoc)
            nextDoc()
          })
        }

        function processLinked(err, linkedDocs) {
          if (err) return cb(err)

          // logPerf(docsSelector, linkedDocs.length, timer.read())
          if (!linkedDocs.length) return cb()

          // If the user chose a restricted link field set make sure _id is included
          if (tipe.isObject(linkq.linkFields) && !_.isEmpty(linkq.linkFields)) {
            var linkFields = _.union(['_id'], Object.keys(linkq.linkFields))
          }
          // Make a map of docs by Id, grafting in the link as a subdocument if asked
          var docMap = {}
          linkedDocs.forEach(function(linkedDoc) {
            if (linkq.linkFields) {
              var link = linkMap[linkedDoc._id]
              if (linkFields) link = _.pick(link, linkFields)
              linkedDoc.link = link
            }
            docMap[linkedDoc._id] = linkedDoc
          })

          // Sort the docs results in order of the links
          // Paging for linked docs is controled via sort, limit, and skip
          // properties of the links, not the documents
          var results = []
          links.forEach(function(link) {
            var docId = dirTo ? link._to : link._from
            var doc = docMap[docId]
            if (doc) results.push(docMap[docId])
          })

          // Recurse for nested linked queries
          // if asReader were passed through I believe it would create a security hole
          // but it might be possible to figure out some rules where it would be safe
          // this would enable the fast linked document queries all the way down
          if (linkq.linkCounts || linkq.linkCount || linkq.links || linkq.linked) {
            var linkqOps = _.pick(_.cloneDeep(options), ['user', 'asAdmin', 'refs', 'tag'])
            _.assign(linkqOps, _.pick(linkq, ['linkCounts', 'linkCount', 'links', 'linked']))
            return get(collection, results, linkqOps, pushLinked)
          }

          pushLinked(null, results)

          function pushLinked(err, results) {
            if (err) return cb(err)
            results.forEach(function(result) {
              doc.linked.push(result)
            })
            doc.moreLinked = doc.moreLinked || more || false
            cb()
          }   // pushLinked
        }     // processLinked docs
      }       // getLinkedDocsForDoc


      function logPerf(selector, count, time) {
        // var out = linkOpt + ' t:' + time + ' n:' + count + ' sel:' + JSON.stringify(selector)
        // debug(out)
        if (config.logSlow && time > config.logSlow && !options.linked) {   // don't log slow outer queries
          read.logSlow(time, 'links', selector, options, null, count)
        }
      }   // logPerf
    }     // getLinkq
  }       // getLinkOpts


  function finish(err) {
    if (err) return cb(err)
    if (options.docsWasObject) {
      if (docs.length) docs = docs[0]
      else docs = []
    }
    cb(null, docs)
  }
}

exports.get = get
exports._safeSpecs = specs
