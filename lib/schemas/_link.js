/**
 *  Links base schema
 *
 *     fields and methods required for safeFind to work.  Proxibase app logic
 *     is in links.js
 *
 *     TODO: write a collectGarbage method
 */


var link = {

  fields: {
    _from:        { type: 'string', required: true },
    _to:          { type: 'string', required: true },
    fromSchema:   { type: 'string' },
    toSchema:     { type: 'string' },
    position:     { type: 'number' },
  },

  indexes: [
    { index: '_from' },
    { index: '_to' },
    { index: 'fromSchema' },
    { index: 'toSchema' },
    { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
  ],

  validators: {
    all: [findFromDoc, findToDoc],
  }
}


function findFromDoc(doc, previous, options, next) {

  var fromId = util.parseId(doc._from)
  if (!(fromId && fromId.schemaName)) return next()
  doc.fromSchema = fromId.schemaName
  var clFrom = statics.schemas[doc.fromSchema].collection
  this.db[clFrom].findOne({_id: doc._from}, function(err, docFrom) {
    if (err) return next(err)
    if (docFrom) options.docFrom = docFrom
    next()
  })
}


function findToDoc(doc, previous, options, next) {

  var toId = util.parseId(doc._to)
  if (!(toId && toId.schemaName)) return next()
  doc.toSchema = toId.schemaName
  var clTo = statics.schemas[doc.toSchema].collection
  this.db[clTo].findOne({_id: doc._to}, function(err, docTo) {
    if (err) return next(err)
    if (docTo) options.docTo = docTo
    next()
  })
}


module.exports = (function() {
  return link
})()
