/**
 *  Links base schema
 */


var parseId = util.parseId
var adminId = util.adminId

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
    insert: [setLinkSchemas, confirmFrom, confirmTo],
    update: [setLinkSchemas, confirmFrom, confirmTo],
  }
}


function setLinkSchemas(doc, previous, options, next) {
  var fromId = parseId(doc._from)
  if (!(fromId && fromId.schemaName)) {
    return next(proxErr.badValue('Invalid _from, schema not known: ' + doc._from))
  }
  doc.fromSchema = fromId.schemaName

  var toId = parseId(doc._to)
  if (!(toId && toId.schemaName)) {
    return next(proxErr.badValue('Invalid _to, schema not known: ' + doc._to))
  }
  doc.toSchema = toId.schemaName

  next()
}


function confirmFrom(doc, previous, options, next) {
  var clFrom = statics.schemas[doc.fromSchema].collection
  this.db[clFrom].findOne({_id: doc._from}, function(err, docFrom) {
    if (err) return next(err)
    if (!docFrom) {
      return next(perr.badValue('Insert/update link failed, _from document not found'))
    }
    var asAdmin = (options.asAdmin || 'admin' === options.user.role)
    var userOwnsFromDoc = (options.user._id === docFrom._owner)
    if (!(asAdmin || userOwnsFromDoc || adminId === docFrom._owner)) {
      return next(perr.badAuth('User ' + options.user._id +
          ' cannot create a link from document ' + docFrom._id +
          ' owned by ' + docFrom._owner))
    }
    doc._owner = docFrom._owner
    doc._creator = docFrom._creator
    doc._modifier = docFrom._modifier
    return next()
  })
}

function confirmTo(doc, previous, options, next) {
  var clTo = statics.schemas[doc.toSchema].collection
  this.db[clTo].findOne({_id: doc._to}, function(err, docTo) {
    if (err) return next(err)
    if (!docTo) return next(perr.badValue('Insert/update link failed, _to document not found'))
    return next()
  })
}


module.exports = (function() {
  return link
})()
