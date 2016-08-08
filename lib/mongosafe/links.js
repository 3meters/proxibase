/**
 * Mongosafe links
 *    Read links and linked documents.
 */


var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var read = require('./read')

// Top-level options that are passed down to nested queries
var inheritedOptions = ['user', 'asAdmin', '_acl', 'refs', 'utc', 'tag']

// Default to most recent
var linkSortSpec = {
  type: 'object|array|string',
  default: '-activityDate',
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

  // Called with empty object or array
  if (!docs.length) return finish()

  // Backwards compat mapping deprecated method
  if (options.linkCount && !options.linkCounts) {
    options.linkCounts = options.linkCount
  }
  delete options.linkCount

  // Make an array of doc ids and a map of docs by id
  var docIds = []
  var docMap = {}
  docs.forEach(function(doc) {
    docIds.push(doc._id)
    docMap[doc._id] = doc
  })


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

      var dirTo                   // Direction to or from
      var direction               // scruf, remove
      var clName

      // Build up the link selector starting with the filter if it exists
      var selector = _.assign({}, linkq.filter)

      if (linkq.to) {
        dirTo = true
        direction = 'to'
        clName = linkq.to
        _.assign(selector, {toSchema: db.safeCollection(linkq.to).schema.name})
      }
      else {
        dirTo = false
        direction = 'from'
        clName = linkq.from
        _.assign(selector, {fromSchema: db.safeCollection(linkq.from).schema.name})
      }

      if (linkq.type) selector.type = linkq.type
      if (tipe.isDefined(linkq.enabled)) selector.enabled = linkq.enabled

      // Converts $in clauses with single targets into simple property checks
      // eg:  _to: {$in: [us.adminId]} becomes _to: us.adminId
      // This code should live inside mongodb, but as of version 3.6 does not.
      read.optimizeSelector(selector)

      // Get either the counts or the links
      if (linkOpt === 'linkCounts') {
        return getLinkCountsFromDb(nextLinkq)
      }
      else {
        return getLinksFromDb(nextLinkq)
      }


      // Use the aggreation framework to bulk count the links to all documents
      // TODO: PERF:  We should aggregate these stats live, possibly in a separate
      // db, and query them directly.
      function getLinkCountsFromDb(cb) {

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

          cb()
        })
      }

      // LinkOpt is links or linked.  First get the links
      function getLinksFromDb(cb) {

        // Sort, skip, and limit only apply to the links themselves,
        // not the underlying documents
        var linkOps = {
          sort: linkq.sort,
          limit: config.limits.max || 1000,   // results will be loaded into memory
          skip: 0,
        }

        // Paging sublinks of a single document
        if (docs.length === 1) {
          linkOps.limit = linkq.limit || config.limits.default
          linkOps.skip = linkq.skip || 0
        }

        // Ask for one more than the limit to see if there are too many results
        linkOps.limit++

        // The fields param applies to the links for a links query or to the linked documents for a linked query
        if (options.links && !_.isEmpty(linkq.fields)) {
          linkOps.fields = _.extend(linkq.fields, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1, type: 1})
        }

        // Query either to side or from side
        _.assign(selector, dirTo ? {_from: {$in: docIds}} : {_to: {$in: docIds}})

        // If an $in clause contains but one element convert it to straight select
        read.optimizeSelector(selector)

        var timer = util.timer()
        db.links.find(selector, linkOps).toArray(function(err, links) {
          if (err) return finish(err)

          // debug('linkSelector', selector)
          // debug('linkOps', linkOps)
          // debug('links', links)

          var more = false
          linkOps.limit--

          var cLinks = (links && links.length) || 0
          logPerf(selector, cLinks, timer.read())

          // See if the query would return more links than we can safely load into memory
          if (cLinks > linkOps.limit) {

            links.pop()  // We asked for one more than did the caller, delete it

            if (docs.length === 1) more = true // No problem, regular paging

            else {

              //
              // This is a tricky situation.  The link query is for an array of documents
              // and the total number of links for all the documents has exceded the join
              // limit.
              //
              // We can either return the error to the caller, which would return a 403
              // (exceded limit) error on the whole request, or we could call back without
              // the error and continue to process the other queries.  If we go that route
              // we need to add a partial fail to the errors collection and return a 202.
              //
              // Opting for request failure with error for now since it is simpler, but may
              // need to revist. In particular there is no way for the caller to find out
              // which of the children bequethed too many grandchildren to accomadate.  We
              // could run a linkCount query by doc._id to find the offending doc.
              //
              err = perr.excededLimit('Link query execeded join limit: ' + linkOps.limit, selector)
              logErr(err)
              return cb(err)
            }
          }

          if (linkOpt === 'linked') return getLinkedDocs(links, more, cb)

          // This is a links query, graft in the results under the right docs

          // Make sure the links array exists and that cLinks, which is the count
          // of links added to this doc *by this link query* is initialized to zero.
          docs.forEach(function(doc) {
            doc.links = doc.links || []
            doc.cLinks = 0
          })

          // Docs can be a singlton or an array
          // Links can be an array matching an array of docs
          // This runs once per each link query, which can be an array
          links.forEach(function(link) {
            var doc = dirTo ? docMap[link._from] : docMap[link._to]
            if (doc.cLinks < linkq.limit) {
              doc.links.push(link)
              doc.cLinks++
            }
            else doc.moreLinks = true
          })

          // Now remove the internal link counter for this query
          docs.forEach(function(doc) {
            delete doc.cLinks
          })

          cb()
        })  // db.links.find
      }     // getLinksFromDb


      // Given an array of links with a more flag look up the linked docuemnts
      function getLinkedDocs(links, more, cb) {

        debug('links getLinkedDocs links', links)

        // Make sure the linked array exists and the moreLinked flag is set
        docs.forEach(function(doc) {
          doc.linked = doc.linked || []
          if (linkq.more) doc.moreLinked = doc.moreLinked || more   // single doc case only
        })

        // Short circuit query if no inputs
        if (!links.length) return cb()

        var linkedDocIds = []
        links.forEach(function(link) {
          linkedDocIds.push(dirTo ? link._to : link._from)
        })

        var linkedDocsSelector = _.assign({}, linkq.linkedFilter)
        _.assign(linkedDocsSelector, {_id: {$in: linkedDocIds}})

        read.optimizeSelector(linkedDocsSelector)

        // Whitelist some top-level query options that make sense for linked docs
        var linkedDocsOps = _.pick(_.cloneDeep(options), inheritedOptions)
        _.assign(linkedDocsOps, _.pick(linkq, ['refs', 'fields']))

        // Single doc case, linkq limit applies
        debug('linked docs parents', docs)
        if (docs.length === 1) linkedDocsOps.limit = linkq.limit

        var findMethod = _.isString(linkedDocsSelector._id) ? 'safeFindOne' : 'safeFind'

        var timer = util.timer()
        db[clName][findMethod](linkedDocsSelector, linkedDocsOps, function(err, linkedDocs) {
          if (err) return finish(err)

          // Convert results to array if necessary
          if (findMethod === 'safeFindOne') linkedDocs = [linkedDocs]

          // debug('linkedDocsSelector', linkedDocsSelector)
          // debug('linkedDocsOps', linkedDocsOps)
          // debug('linkedDocs', linkedDocs)

          logPerf(linkedDocsSelector, linkedDocs.length, timer.read())

          // Make a map of links by linkedDocId
          var linkMap = {}
          links.forEach(function(link) {
            var linkedDocId = dirTo ? link._to : link._from
            linkMap[linkedDocId] = link
          })

          // If the user chose a restricted link field set make sure _id is included
          var linkFields = null
          if (tipe.isObject(linkq.linkFields) && !_.isEmpty(linkq.linkFields)) {
            linkFields = _.union(['_id'], Object.keys(linkq.linkFields))
          }

          // If linkq.linkFields is set then graft in each link beneath
          // the linked document
          if (linkq.linkFields) {
            linkedDocs.forEach(function(linkedDoc) {
                var link = linkMap[linkedDoc._id]
                if (linkFields) link = _.pick(link, linkFields)
                linkedDoc.link = link
            })
          }

          // Recurse for nested linked queries
          if (linkq.linkCounts || linkq.linkCount || linkq.links || linkq.linked) {
            var linkqOps = _.pick(_.cloneDeep(options), inheritedOptions)
            _.assign(linkqOps, _.pick(linkq, ['linkCounts', 'linkCount', 'links', 'linked']))
            return get(collection, linkedDocs, linkqOps, graftLinked)
          }

          graftLinked(null, linkedDocs)

          function graftLinked(err, linkedDocs) {
            if (err) return cb(err)

            var linkedDocMap = {}
            linkedDocs.forEach(function(linkedDoc) {
              linkedDocMap[linkedDoc._id] = linkedDoc
            })

            links.forEach(function(link, i) {
              var docId = dirTo ? link._from : link._to
              var linkedDocId = dirTo ? link._to : link._from
              var doc = docMap[docId]
              var linkedDoc = linkedDocMap[linkedDocId]
              if (linkedDoc) {
                if (i < linkq.limit) doc.linked.push(linkedDoc)
                else {
                  doc.moreLinked = true
                  return
                }
              }
            })

            cb()
          }   // pushLinked
        })     // db.cl.findLinked
      }       // getLinkedDocs


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
