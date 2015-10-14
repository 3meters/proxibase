/**
 * Mongosafe getRefs
 */

var tipe = require('tipe')    // jshint ignore:line
var scrub = require('scrub')  // jshint ignore:line
var async = require('async')
var read = require('./read')
var parse = require('./parse')

var _config

// Populate refs (aka foreign keys) with data from referenced collections
// Refs can be static, meaning one key always points to one collection,
// or dynaminc, meaning one key can point to one collection for one document,
// and another collection for another document.  For dynamic refs, the ref
// property of the schema is a function that returns the name of the schema
// that this key of this document's points to.  The _links collection uses
// these dynamic joins
function getRefs(collection, docs, options, cb) {

  // lazy load due to circular dependency with read
  if (tipe.isUndefined(_config)) _config = read.config()

  var db = collection.db

  if (docs.length > _config.limits.join) {
    return cb(perr.excededLimit('Cannot use refs on results larger than ' +
        _config.limits.join + '. Restrict your query further and try again.'))
  }

  var refs = collection.schema.refs

  // Check the args
  var refFields = parse.arg(options.refs)
  if (tipe.isError(refFields)) return cb(refFields)
  if (!refFields) return cb(null, docs)
  if (tipe.isBoolean(refFields)) refFields = {name: 1}  // true means return name
  if (!tipe.isObject(refFields)) {
    return cb(perr.serverError('Could not parse refs query', options.refs))
  }

  // Build a map of refs to look up
  var refMap = {}
  docs.forEach(function(doc) {
    Object.keys(refs).forEach(function(field) {
      if (!doc[field]) return
      // Ref can be the name of a collection or a function that
      // returns a collection name based on a value in the doc
      var clName = getRefClName(refs[field], doc)
      if (!(clName && db.safeCollection(clName))) return
      refMap[clName] = refMap[clName] || {}
      refMap[clName][doc[field]] = true  // map the id to look up
    })
  })

  async.each(Object.keys(refMap), getRefDocs, finish)

  function getRefDocs(clName, nextCl) {

    // Convert to an ordered array for passing to mongodb find $in
    var ids = Object.keys(refMap[clName]).sort()

    // Get the referenced documents
    var ops = {
      user: options.user,
      asAdmin: options.asAdmin,
      asReader: options.asReader,
      tag: options.tag,
    }

    db[clName].safeFind({_id: {$in: ids}}, ops, function(err, refDocs) {
      if (err) return finish(err)

      if (!(refDocs && refDocs.length)) return nextCl()

      refDocs.forEach(function(refDoc) {
        refMap[clName][refDoc._id] = refDoc   // the rub
      })

      nextCl()
    })
  }

  function finish(err) {
    if (err) return cb(err)

    // graft in the results
    docs.forEach(function(doc) {
      for (var field in refs) {
        if (!doc[field]) continue
        var clName = getRefClName(refs[field], doc)
        if (!clName) continue

        // strip the leading _ from the key name for the ref value name
        var refFieldName = (field === '_id')
          ? 'name'            // self join often on the users collection
          : field.slice(1)    // e.g. _owner => owner
        var refDoc = refMap[clName][doc[field]]

        if (!refDoc) continue

        /*
         *  Graft in the ref document. Its shape is determined by the refs param.
         *
         *  1. refs is boolean true or a positive number,
         *     the value of the name property is promoted to the outer doc
         *  2. refs is a string naming just one field, e.g. refs=name,
         *     the value of that field alone is promoted to the outer doc
         *  3. refs is a comma-separated list of field names, e.g. refs=_id,name,role,
         *     or an object with a name map, the specified fields of the rest doc
         *     are nested under the ref name
         *  4. refs is a single character '*', the entire document is nested under
         *     the object
         */
        // Simple boolean, just the name property
        if (tipe.isBoolean(refFields)) {
          doc[refFieldName] = refDoc.name
        }
        else {
          // Empty object, include the entire document
          if (_.isEmpty(refFields)) {
            doc[refFieldName] = _.cloneDeep(refDoc)
          }
          else {
            // Specific fields requested
            var keys = Object.keys(refFields)
            // Only one field, promote it as a top level property
            if (keys.length === 1) {
              // refs = 'name' or refs = {name: 1}
              // don't nest object, set ref to value
              if (refDoc[keys[0]]) doc[refFieldName] = refDoc[keys[0]]
            }
            else {
              // More than one field listed, create a nested object with all the listed fields
              doc[refFieldName] = {}
              for (var qryField in refFields) {
                // cloning because reference can be circular
                if (refDoc[qryField]) doc[refFieldName][qryField] = _.cloneDeep(refDoc[qryField])
              }
              if (_.isEmpty(doc[refFieldName])) delete doc[refFieldName]
            }
          }
        }
      }
    })
    cb(err, docs)
  }
}


// Refs can be strings or a function based on values in the doc
// Returns a string or null
function getRefClName(ref, doc) {
  var clName = (tipe.isFunction(ref)) ? ref(doc) : ref
  return (tipe.isString(clName)) ? clName : null
}


module.exports = getRefs
