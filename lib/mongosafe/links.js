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


// linkCount spec
var linkCountSpec = {
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
  linkCount:    {type: 'object|array', strict: false},
}

delete linkedProps.linkFields.default    // default to undefined, not object
linkedSpec.value.value = _.assign(linkedSpec.value.value, linkedProps)


// Map the specs
var specs = {
  linkCount:  linkCountSpec,
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

  if (tipe.isObject(docs)) {
    docs = [docs]
    options.docsWasObject = true
  }

  async.eachSeries(docs, getOuterLinkQueries, finish)

  function getOuterLinkQueries(doc, nextDoc) {

    async.eachSeries(['linkCount', 'links', 'linked'], getOuterLinkQuery, nextDoc)

    function getOuterLinkQuery(linkOpt, nextLinkOpt) {

      var linkQueries = options[linkOpt]
      if (!linkQueries) return nextLinkOpt()

      // Link queries can be a singleton or arrays.
      if (_.isPlainObject(linkQueries)) {
        linkQueries = [linkQueries]
      }

      // Scrub each query as needed.
      var err = scrub(linkQueries, specs[linkOpt], {strict: true, safeCls: db.safeCollectionNames})
      if (err) return cb(err)

      async.eachSeries(linkQueries, getLinkq, nextLinkOpt)

      // Build and run the link query
      function getLinkq(linkq, nextLinkq) {

        var timer = util.timer()
        var results = []
        var counts = {}
        var selector
        var direction
        var cLinks = 0

        // Set up the counter results
        if (linkOpt === 'linkCount') {
          if (linkq.to) {
            counts.to = {}
            counts.to[linkq.to] = {}
            counts.to[linkq.to][linkq.type] = 0
            if (tipe.isDefined(linkq.enabled)) {
              counts.to[linkq.to][linkq.type] = {enabled: 0, disabled: 0}
            }
          }
          else {
            counts.from = {}
            counts.from[linkq.from] = {}
            counts.from[linkq.from][linkq.type] = 0
            if (tipe.isDefined(linkq.enabled)) {
              counts.from[linkq.from][linkq.type] = {enabled: 0, disabled: 0}
            }
          }
        }

        // Build the link query selector
        if (linkq.to) {
          direction = 'to'
          selector = {
            _from: doc._id,
            toSchema: db.safeCollection(linkq.to).schema.name,
          }
        }
        else {
          direction = 'from'
          selector = {
            _to: doc._id,
            fromSchema: db.safeCollection(linkq.from).schema.name,
          }
        }
        if (linkq.type) selector.type = linkq.type

        // For links and linked queries the enabled property is
        // part of the selector.  For linkCount query it means
        // select them all and count wich are true and which are false
        if (tipe.isDefined(linkq.enabled) && linkOpt !== 'linkCount') {
          selector.enabled = linkq.enabled
        }

        // Optional filter.  Ignore the _to or _from if set
        if (!_.isEmpty(linkq.filter)) {
          if (direction === 'to') delete linkq.filter._from
          else delete linkq.filter._from
          _.assign(selector, linkq.filter)
        }

        read.optimizeSelector(selector)

        getLinksFromDb(selector, direction, finishLinkQuery)

        function getLinksFromDb(selector, direction, cb) {

          // sort, skip, and limit only apply to the links themselves,
          // not the underlying documents
          var linkCursorOps = {
            sort: linkq.sort,
            limit: Math.min(linkq.limit, config.limits.join),
            skip: linkq.skip || 0,
          }

          // For counts count up to the join limit
          if (linkOpt === 'linkCount') linkCursorOps.limit = config.limits.join

          // Check for more records
          if (linkq.more) linkCursorOps.limit++

          // The fields param applies to links for a links query, or linked documents for a linked query
          if (options.links && !_.isEmpty(linkq.fields)) {
            linkCursorOps.fields = _.extend(linkq.fields, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1})
          }

          var cursor = db.links.find(selector, linkCursorOps)

          if (config.explain) {
            cursor.explain(function(err, expl) {
              log('Explain: getLinks selector', selector)
              log('Explain:', expl)
            })
          }

          async.forever(getLink)

          function getLink(nextLink) {
            cursor.nextObject(function(err, link) {
              if (err || !link) {
                cursor.close()
                return cb(err)
              }

              // See if the cursor exceeded the limit indicating that the
              // caller can page further
              cLinks++
              if (linkq.more) {
                if (cLinks >= linkCursorOps.limit) {
                  if (linkOpt === 'linked') doc.moreLinked = true
                  if (linkOpt === 'links') doc.moreLinks = true
                  cursor.close()
                  return cb()
                }
              }

              // The link might be an orphan from old schema changes
              // See https://github.com/3meters/proxibase/issues/208
              var toSchema = db.safeSchema(link.toSchema)
              var fromSchema = db.safeSchema(link.fromSchema)
              if (!(toSchema && fromSchema)) {
                logErr('Invalid link, unrecognized schema', link)
                return nextLink()
              }

              // Determine the collection
              var cl = ('to' === direction)
                ? toSchema.collection
                : fromSchema.collection

              // Count query
              if (linkOpt === 'linkCount') {
                if (linkq.enabled) {
                  if (link.enabled) counts[direction][cl][linkq.type].enabled++
                  else counts[direction][cl][linkq.type].disabled++
                }
                else counts[direction][cl][linkq.type]++
                return nextLink()
              }

              // If called via links, rather than linked, skip the document fetch
              // and return a top level array of links
              if (linkOpt === 'links') {
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
                refs: linkq.refs || options.refs,
                utc: options.utc,
                tag: options.tag,
              }

              // Only add field spec if it is non-empty
              if (!_.isEmpty(linkq.fields)) {
                findDocOps.fields = linkq.fields
              }

              // Find the linked doc with the linkedFilter on. If found push on results.
              db[cl].safeFindOne(docSelector, findDocOps, function(err, linkedDoc) {

                if (err) return cb(err)
                if (!linkedDoc) return nextLink()

                // Decide whether to add a link to the document, and if so, what fields
                // Default is to include nothing.  If set to a field list, union that list
                // with the system fields.  If set to a truthy scalar or an empty object,
                // include the entire link document.  Remember that linked docs are included in one flat
                // array, even if they were found by multiple linked queries, so at least
                // link _to, _from, and type are required for the caller to disambiguate
                // why an individual document was included in the results multiple times.
                if (tipe.isDefined(linkq.linkFields)) {
                  if (tipe.isObject(linkq.linkFields)) {
                    if (_.isEmpty(linkq.linkFields)) {   // linkFields = {}
                      linkedDoc.link = link
                    }
                    else {
                      var keys = _.union(['_id'], Object.keys(linkq.linkFields))
                      linkedDoc.link = _.pick(link, keys)
                    }
                  }
                  // value is scalar
                  else if (tipe.truthy(linkq.linkFields)) {
                    linkedDoc.link = link
                  }
                }

                results.push(linkedDoc)
                nextLink()
              })
            })
          }
        }

        function finishLinkQuery(err, moreLinks) {
          if (err) return nextLinkq(err)

          var time = timer.read()
          var out = linkOpt + ' t:' + time + ' n:' + cLinks  + ' found:' +
              (results && results.length) + ' sel:' + JSON.stringify(selector)
          // debug(out)
          if (config.logSlow && time > config.logSlow && !options.linked) {   // don't log slow outer queries
            read.logSlow(time, 'links', selector, options, err, results)
          }

          // Recurse for nested linked queries
          if (linkOpt === 'linked' && results && results.length &&
              (linkq.linkCount || linkq.links || linkq.linked)) {
            var linkqOps = {
              user: options.user,
              asAdmin: options.asAdmin,
              asReader: options.asReader,
              refs: options.refs,
              tag: options.tag,
              linkCount: linkq.linkCount,
              links:  linkq.links,
              linked: linkq.linked,
            }
            return get(collection, results, linkqOps, pushLinked)
          }

          // Either counts or documents, but not both.
          // This is like mongodb but unlike /do/getEntities.
          if (linkOpt === 'linkCount') {
            // add link counts
            doc.linkCount = doc.linkCount || {}
            doc.linkCount = _.merge(doc.linkCount, counts)
            return nextLinkq()
          }

          if (linkOpt === 'links') {
            doc.links = doc.links || []
            results.forEach(function(result) {
              doc.links.push(result)
            })
            if (moreLinks) doc.moreLinks = moreLinks
            return nextLinkq()
          }

          if (linkOpt === 'linked') pushLinked(null, results)

          function pushLinked(err, results) {
            doc.linked = doc.linked || []
            results.forEach(function(result) {
              doc.linked.push(result)
            })
            if (moreLinks) doc.moreLinks = moreLinks
            nextLinkq()
          }
        }
      }   // getLinkq
    }
  }

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
