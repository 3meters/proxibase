/**
 *  Links base schema
 *
 *     fields and methods required for safeFind to work.  Proxibase app logic
 *     is in links.js
 *
 *     TODO: write a collectGarbage method
 */


var link = {

  ownerAccess: false,  // public for now

  fields: {
    _from:        { type: 'string', required: true, ref: fromCollection },
    _to:          { type: 'string', required: true, ref: toCollection },
    type:         { type: 'string', required: 'true'},
    fromSchema:   { type: 'string' },
    toSchema:     { type: 'string' },
    enabled:      { type: 'boolean', default: true }, // controls link active state
    position:     { type: 'number' },
  },

  indexes: [
    { index: '_from' },
    { index: '_to' },
    { index: 'fromSchema' },
    { index: 'toSchema' },
    { index: '_creator' },
    { index: 'createdDate' },
    { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
  ],

  before: {
    read:   [optimize],
    insert: [findFromDoc, findToDoc],
    update: [extendFromPrevious, findFromDoc, findToDoc],
    remove: [extendFromPrevious, findFromDoc, findToDoc],
  },

}


//
// Mongo db 2.6.10 and 3.0.3 has a bug whereby sorting descending by
// modifiedDate yeilds pathological perf.  Since we don't really
// allow modifying the main properties of links, and since _ids
// normally increase over time, just change the sort specification
// of the caller from modifiedDate to _id.
//
// Option deoptimize renders this a no-op.
//
// If mongo ever fixes their bug this can be removed.
//
function optimize(query, options, cb) {
  if (options.deoptimize || util.config.db.deoptimize) return cb(null, query, options)
  if (options.sort) {
    options.sort.forEach(function(sortPair) {
      if (sortPair[0] === 'modifiedDate') sortPair[0] = '_id'
    })
  }
  cb(null, query, options)
}


function fromCollection(doc) {
  if (doc.fromSchema && statics.schemas[doc.fromSchema]) {
    return statics.schemas[doc.fromSchema].collection
  }
  else return null
}

function toCollection(doc) {
  if (doc.toSchema && statics.schemas[doc.toSchema]) {
    return statics.schemas[doc.toSchema].collection
  }
  else return null
}

function extendFromPrevious(doc, previous, options, next) {
  for (var key in previous) {
    if (tipe.isUndefined(doc[key])) doc[key] = previous[key]
  }
  next()
}

function findFromDoc(doc, previous, options, next) {

  var fromId = util.parseId(doc._from)
  if (!(fromId && fromId.schemaName)) {
    return next(perr.badValue('Invalid _from: ' + doc._from))
  }
  doc.fromSchema = fromId.schemaName
  var clFrom = statics.schemas[doc.fromSchema].collection
  options.clFrom = clFrom
  this.db[clFrom].safeFindOne({_id: doc._from}, options, function(err, docFrom) {
    if (err) return next(err)
    // if (!docFrom && options.method !== 'remove') return next(perr.badValue(doc._from))
    options.docFrom = docFrom
    next()
  })
}


function findToDoc(doc, previous, options, next) {

  var toId = util.parseId(doc._to)
  if (!(toId && toId.schemaName)) {
    return next(perr.badValue(doc._to))
  }
  doc.toSchema = toId.schemaName
  var clTo = statics.schemas[doc.toSchema].collection
  options.clTo = clTo
  this.db[clTo].safeFindOne({_id: doc._to}, options, function(err, docTo) {
    if (err) return next(err)
    // if (!docTo && options.method !== 'remove') return next(perr.badValue(doc._to))
    options.docTo = docTo
    next()
  })
}


module.exports = (function() {
  return link
})()
