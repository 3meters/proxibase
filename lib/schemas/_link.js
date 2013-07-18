/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */


var db = util.db
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
    insert: [setLinkCollections, setLinkSchemas],
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
