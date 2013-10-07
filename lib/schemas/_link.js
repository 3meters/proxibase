/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */


var parseId = util.parseId
var mongo = require('../db')

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
    if (!fromDoc) return next(perr.badValue('Insert/update link failed, _from document not found'))
    if (options.asAdmin || 'admin' == options.user.role) return next()
    if (options.user._id === fromDoc._owner) return next()
    else {
      if (util.adminUser._id !== fromDoc._owner) {
        return next(perr.badAuth())  // can't create a link from a doc that another user owns
      }
      /*
      log('Setting admin as owner for link', doc)
      log('with user', options.user)
      log('linked from', fromDoc)
      */
      // This next may open us to abuse
      doc._owner = util.adminUser._id
      doc._creator = fromDoc._creator    // may be anon user
      doc._modifier = fromDoc._modifier  // ditto
      return next()
    }
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
