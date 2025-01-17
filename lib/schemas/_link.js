/**
 *  Links base schema
 *
 *     fields and methods required for safeFind to work.  Proxibase app logic
 *     is in links.js
 *
 */


var link = {

  public: true,  // public for now, try setting to false and see what breaks

  fields: {
    _from:        { type: 'string', required: true, ref: fromCollection },
    _to:          { type: 'string', required: true, ref: toCollection },
    type:         { type: 'string', required: 'true'},
    fromSchema:   { type: 'string' },
    toSchema:     { type: 'string' },
  },

  indexes: [
    { index: '_from' },
    { index: '_to' },
    { index: 'toSchema' },
    { index: 'fromSchema' },
    { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
  ],

  before: {
    insert: [findFromDoc, findToDoc],
    update: [extendFromPrevious, findFromDoc, findToDoc],
    remove: [extendFromPrevious, findFromDoc, findToDoc],
  },

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
    if (!this.schema.fields[key]) return next()  // only copy fields in the current schema from previous
    if (tipe.isUndefined(doc[key])) {
      doc[key] = previous[key]
    }
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
  var findOps = _.extend(_.cloneDeep(options), {refs: 'name,schema,photo'})
  delete findOps.fields
  delete findOps.method
  this.db[clFrom].safeFindOne({_id: doc._from}, findOps, function(err, docFrom) {
    if (err) return next(err)
    options.docFrom = docFrom
    options.clFrom = clFrom
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
  var findOps = _.extend(_.cloneDeep(options), {refs: 'name,schema,photo'})
  delete findOps.fields
  delete findOps.method
  delete findOps.docFrom
  delete findOps.clFrom
  this.db[clTo].safeFindOne({_id: doc._to}, findOps, function(err, docTo) {
    if (err) return next(err)
    options.clTo = clTo
    options.docTo = docTo
    next()
  })
}


module.exports = (function() {
  return link
})()
