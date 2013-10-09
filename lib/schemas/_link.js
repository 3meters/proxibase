/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */


var parseId = util.parseId
var mongo = require('../db')
var adminId = util.adminId

var link = {
  /*
   * The strong property has important behavior. When set to true, the 'from' entity will 
   * be deleted with the link. Updates to the 'from' entity will set the activityDate 
   * of the 'to' entity. Inserting an entity that already has a strong link will also 
   * set the ActivityDate of the 'to' entity.
   */
  fields: {
    _from:              { type: 'string', required: true },
    _to:                { type: 'string', required: true },
    fromCollection:     { type: 'string' },
    toCollection:       { type: 'string' },
    position:           { type: 'number' },
  },

  indexes: [
    { index: '_from' },
    { index: '_to' },
    { index: 'fromCollection' },
    { index: 'toCollection' },
    { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
  ],

  validators: {
    insert: [setLinkCollections, confirmFrom, confirmTo],
    update: [setLinkCollections, confirmFrom, confirmTo],
  }
}


function setLinkCollections(doc, previous, options, next) {
  var fromId = parseId(doc._from)
  if (!(fromId && fromId.collectionName)) {
    return next(proxErr.badValue('Invalid collection prefix: ' + doc._from))
  }
  doc.fromCollection = fromId.collectionName

  var toId = parseId(doc._to)
  if (!(toId && toId.collectionName)) {
    return next(proxErr.badValue('Invalid collection prefix: ' + doc._to))
  }
  doc.toCollection = toId.collectionName

  next()
}


function setLinkSchemas(doc, previous, options, next) {
  var fromId = parseId(doc._from)
  if (!(fromId && fromId.collectionName)) {
    return next(proxErr.badValue('Invalid schema: ' + fromId.collectionName))
  }
  doc.fromSchema = util.statics.collectionSchemaMap[fromId.collectionName]

  var toId = parseId(doc._to)
  if (!(toId && toId.collectionName)) {
    return next(proxErr.badValue('Invalid schema: ' + toId.collectionName))
  }
  doc.toSchema = util.statics.collectionSchemaMap[toId.collectionName]

  next()
}


function confirmFrom(doc, previous, options, next) {
  this.db[doc.fromCollection].findOne({_id: doc._from}, function(err, fromDoc) {
    if (err) return next(err)
    if (!fromDoc) {
      return next(perr.badValue('Insert/update link failed, _from document not found'))
    }
    var asAdmin = (options.asAdmin || 'admin' === options.user.role)
    var userOwnsFromDoc = (options.user._id === fromDoc._owner)
    if (!(asAdmin || userOwnsFromDoc || adminId === fromDoc._owner)) {
      return next(perr.badAuth('User ' + options.user._id +
          ' cannot create a link from document ' + fromDoc._id +
          ' owned by ' + fromDoc._owner))
    }
    doc._owner = fromDoc._owner
    return next()
  })
}

function confirmTo(doc, previous, options, next) {
  this.db[doc.toCollection].findOne({_id: doc._to}, function(err, toDoc) {
    if (err) return next(err)
    if (!toDoc) return next(perr.badValue('Insert/update link failed, _to document not found'))
    return next()
  })
}


module.exports = (function() {
  return link
})()
