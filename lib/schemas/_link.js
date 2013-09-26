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
    fromCollectionId:   { type: 'string' },
    toCollectionId:     { type: 'string' },
    fromSchema:         { type: 'string' },
    toSchema:           { type: 'string' },
    strong:             { type: 'boolean', default: false },
    inactive:           { type: 'boolean', default: false },                // disable link while keeping the history
    proximity:          { type: 'object', value: {
      primary:            { type: 'boolean' },
      signal:             { type: 'number' },
    }},
  },

  indexes: [
    { index: '_from' },
    { index: '_to' },
    { index: 'fromCollectionId' },
    { index: 'toCollectionId' },
    { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
  ],

  validators: {
    insert: [setLinkCollections, setLinkSchemas, confirmFrom, confirmTo],
    update: [setLinkCollections, setLinkSchemas],
    remove: [removeActions]
  }
}


function setLinkCollections(doc, previous, options, next) {
  var fromId = parseId(doc._from)
  if (!(fromId && fromId.collectionId)) {
    return next(proxErr.badValue('Invalid collectionId: ' + fromId.collectionId))
  }
  doc.fromCollectionId = fromId.collectionId

  var toId = parseId(doc._to)
  if (!(toId && toId.collectionId)) {
    return next(proxErr.badValue('Invalid collectionId: ' + toId.collectionId))
  }
  doc.toCollectionId = toId.collectionId

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
  var from = statics.collectionIdMap[doc.fromCollectionId]
  this.db[from].findOne({_id: doc._from}, function(err, fromDoc) {
    if (err) return next(err)
    if (!fromDoc) return next(perr.badValue('Create link failed, _from document not found'))
    if (options.asAdmin || 'admin' == options.user.role) return next()
    if (options.user._id === fromDoc._owner) return next()
    else {
      if (util.adminUser._id !== fromDoc._owner) {
        return next(perr.badAuth())  // can't create a link from a doc that another user owns
      }
      log('Setting admin as owner for link', doc)
      log('with user', options.user)
      log('linked from', fromDoc)
      // This next may open us to abuse
      doc._owner = util.adminUser._id
      return next()
    }
  })
}

function confirmTo(doc, previous, options, next) {
  var to = statics.collectionIdMap[doc.toCollectionId]
  this.db[to].findOne({_id: doc._to}, function(err, toDoc) {
    if (err) return next(err)
    if (!toDoc) return next(perr.badValue('Create link failed, _to document not found'))
    return next()
  })
}


function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing actions for link: ' + previous._id)
  this.db.actions.remove({ _target:previous._id }, function(err) {
    if (err) return next(err)
    next()
  })
}

module.exports = (function() {
  return link
})()
