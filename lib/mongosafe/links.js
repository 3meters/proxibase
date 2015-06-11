/**
 * Mongosafe links
 *    Read links and linked documents.
 */


var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var parse = require('./parse')
var read = require('./read')


// linkCount spec
var linkCountSpec = {
  type: 'array|object',
  value: {
    to:       {strict: false, value: parse.arg},
    from:     {strict: false, value: parse.arg},
    type:     {type: 'string', required: true, validate: function(v) {
      if (v.indexOf(',') >= 0) {
        return 'linkCount does not support multiple types. Use an array of linkCount queries.'
      }}},
    enabled:  {type: 'boolean'},
    filter:   {type: 'object', strict: false, default: {}},
  },
  strict: true,
  validate: validateLinkQuery,
}


// Links spec
var linksSpec = {
  type: 'array|object',
  value: {
    to:          {strict: false, value: parse.arg},
    from:        {strict: false, value: parse.arg},
    type:        {type: 'string'},
    fields:       read.fieldSpec,
    filter:      {type: 'object', strict: false, default: {}},
    sort: {
      type: 'object|array|string',
      default: '-_id',
      value: parse.sort,
    },
    limit:        read.limitSpec,
    more:         {type: 'boolean'},
    skip:         {type: 'number', default: 0},
    refs:         {type: 'boolean|string|object|number'}, // TODO: get from refs module
  },
  strict: true,
  validate: validateLinkQuery,
}


// Extend the LinkedSpec with some additional properties for
// the next-level link queries into the linked documents themselves.
var linkedSpec = _.clone(linksSpec)
var linkedProps = {
  linkedFilter: {type: 'object', strict: false, default: {}},
  linkFields:   read.fieldSpec,
  linked:       {type: 'object|array', strict: false},
  links:        {type: 'object|array', strict: false},
  linkCount:    {type: 'object|array', strict: false},
}
delete linkedProps.linkFields.default    // default to undefined, not object
linkedSpec.value = _.assign(linkedSpec.value, linkedProps)


// Map the specs
var specs = {
  linkCount:  linkCountSpec,
  links:      linksSpec,
  linked:     linkedSpec,
}


/**
 * Ensure that the specified to and from links are known
 * safeCollection names.  If link.to or link.from are
 * booleans set them to {}, meaning all linked records.
 */
function validateLinkQuery(linkQrys, options) {

  var err

  if (tipe.isObject(linkQrys)) linkQrys = [linkQrys]

  linkQrys.forEach(function(linkq) {
    var key

    if (!(linkq.from || linkq.to)) {
      return fail('must specify either from or to')
    }

    if (tipe.isDefined(linkq.to) && !tipe.isObject(linkq.to)) {
      if (tipe.isTruthy(linkq.to)) linkq.to = {}
      else return fail('to: must be an object or a truthy value')
    }

    for (key in linkq.to) {
      if (!options.safeCls[key]) return fail('Unknown collection: ' + key)
      if (!linkq.to[key]) delete linkq.to[key]      // {cl: -1}
    }

    if (tipe.isDefined(linkq.from) && !tipe.isObject(linkq.from)) {
      if (tipe.isTruthy(linkq.from)) linkq.from = {}
      else return fail('from: must be an object or a truthy value')
    }

    for (key in linkq.from) {
      if (!options.safeCls[key]) return fail('Unknown collection: ' + key)
      if (!linkq.from[key]) delete linkq.from[key]   // {cl: -1}
    }
  })

  function fail(msg) {
    err = new Error(msg)
  }
  return err
}


// Main worker
function get(collection, docs, options, cb) {

  var db = collection.db

  var dbConfig = read.config()

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

        var results = []
        var counts = {}
        var key

        if (linkOpt === 'linkCount') {

          // Set up the counters
          if (linkq.to) {
            counts.to = {}
            for (key in linkq.to) {
              counts.to[key] = {}
              counts.to[key][linkq.type] = 0
              if (tipe.isDefined(linkq.enabled)) {
                counts.to[key][linkq.type] = {enabled: 0, disabled: 0}
              }
            }
          }
          if (linkq.from) {
            counts.from = {}
            for (key in linkq.from) {
              counts.from[key] = {}
              counts.from[key][linkq.type] = 0
              if (tipe.isDefined(linkq.enabled)) {
                counts.from[key][linkq.type] = {enabled: 0, disabled: 0}
              }
            }
          }
        }

        buildToInClause()

        function buildToInClause() {
          if (!linkq.to) return buildFromInClause()
          var selector = _.extend(_.cloneDeep(linkq.filter), {_from: doc._id})
          if (linkq.type) selector.type = linkq.type
          if (!_.isEmpty(linkq.to)) {
            selector.toSchema = {$in: []}
            for (var key in linkq.to) {
               selector.toSchema.$in.push(db.safeCollection(key).schema.name)
            }
          }
          getLinksFromDb(selector, 'to', buildFromInClause)
        }


        function buildFromInClause(err) {
          if (err) return nextLinkq(err)
          if (!linkq.from) return finishLinkQuery(null)
          var selector = _.extend(_.cloneDeep(linkq.filter), {_to: doc._id})
          if (linkq.type) selector.type = linkq.type
          if (!_.isEmpty(linkq.from)) {
            selector.fromSchema = {$in: []}
            for (var key in linkq.from) {
              selector.fromSchema.$in.push(db.safeCollection(key).schema.name)
            }
          }
          getLinksFromDb(selector, 'from', finishLinkQuery)
        }


        function getLinksFromDb(selector, direction, cb) {

          var cLinks = 0
          var cEnabled = null
          if (tipe.isDefined(linkq.enabled)) cEnabled = {enabled: 0, disabled: 0}

          // sort, skip, and limit only apply to the links themselves,
          // not the underlying documents
          var linkCursorOps = {
            sort: linkq.sort,
            limit: Math.min(linkq.limit, dbConfig.limits.join),
            skip: linkq.skip,
          }

          // For counts count up to the join limit
          if (linkOpt === 'linkCount') linkCursorOps.limit = dbConfig.limits.join

          // Check for more records
          if (linkq.more) linkCursorOps.limit++

          // The fields param applies to links for a links query, or linked documents for a linked query
          if (options.links && !_.isEmpty(linkq.fields)) {
            linkCursorOps.fields = _.extend(linkq.fields, {_to: 1, _from: 1, toSchema: 1, fromSchema: 1})
          }

          var cursor = db.links.find(selector, linkCursorOps)

          if (read.config().explain) {
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
                if (cEnabled) {
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
              }

              // Only add field spec if it is non-empty
              if (!_.isEmpty(linkq.fields)) {
                findDocOps.fields = linkq.fields
              }

              // Find the linked doc with the linkedFilter on. If found push on results.
              // TODO: cache documents we have already fetched
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

          // Recurse for nested linked queries
          if (linkOpt === 'linked' && results && results.length &&
              (linkq.linkCount || linkq.links || linkq.linked)) {
            var linkqOps = {
              user: options.user,
              asAdmin: options.asAdmin,
              asReader: options.asReader,
              refs: options.refs,
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
