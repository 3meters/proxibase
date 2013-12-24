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
    insert: [findFromDoc, findToDoc, checkInsert],
    update: [extendFromPrevious, findFromDoc, findToDoc],
    remove: [extendFromPrevious, findFromDoc, findToDoc],
  },

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
  this.db[clFrom].findOne({_id: doc._from}, function(err, docFrom) {
    if (err) return next(err)
    if (docFrom) options.docFrom = docFrom
    next()
  })
}


function findToDoc(doc, previous, options, next) {

  var toId = util.parseId(doc._to)
  if (!(toId && toId.schemaName)) {
    return next(perr.badValue('Invalid _to: ' + doc._to))
  }
  doc.toSchema = toId.schemaName
  var clTo = statics.schemas[doc.toSchema].collection
  options.clTo = clTo
  this.db[clTo].findOne({_id: doc._to}, function(err, docTo) {
    if (err) return next(err)
    if (docTo) options.docTo = docTo
    next()
  })
}


function checkInsert(doc, previous, options, next) {

  if (!options.docFrom) {
    return next(perr.badValue('Insert/update link failed, _from document not found'))
  }
  if (!options.docTo) {
    return next(perr.badValue('Insert/update link failed, _to document not found'))
  }
  return next()
}


function checkUpdate(doc, previous, options, next) {

  if ((doc._from !== previous._from) || (doc._to !== previous._to)) {
    return next(perr.forbidden('You cannot update the _from or _to of link'))
  }
  return next()
}

module.exports = (function() {
  return link
})()
