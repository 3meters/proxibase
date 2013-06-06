/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */


var db = util.db
var parseId = util.parseId
var mongo = require('../db')

var link = {

  fields: {
    _from:              { type: 'string', required: true },
    _to:                { type: 'string', required: true },
    fromCollectionId:   { type: 'string' },
    toCollectionId:     { type: 'string' },
    strong:             { type: 'boolean', default: false },  // true means the 'from' entity should be deleted with the link
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
    insert: [setLinkCollections],
    update: [setLinkCollections],
    remove: [removeActions]
  }
}

function setLinkCollections(doc, previous, options, next) {
  var idMap = util.statics.collectionIdMap
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
