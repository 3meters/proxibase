/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var util = require('util')
var db = util.db
var log = util.log
var parseId = util.parseId
var mongo = require('..')
var base = require('./_base')
var links = {}

links.id = util.statics.collectionIds.links

links.fields = {
  _from:        { type: String, required: true },
  _to:          { type: String, required: true },
  fromCollectionId:  { type: String },
  toCollectionId:    { type: String },
  primary:      { type: Boolean },
  signal:       { type: Number }
}

links.indexes = [
  { index: '_from' },
  { index: '_to' },
  { index: 'fromCollectionId' },
  { index: 'toCollectionId' },
  { index: {_from: 1, _to: 1, type: 1}, options: {unique: true}}
]

links.validators = {
  insert: [setLinkCollections],
  update: [setLinkCollections],
  remove: [removeActions]
}


function setLinkCollections(doc, previous, options, next) {
  var IdMap = util.statics.collectionIdMap
  var fromId = parseId(doc._from)
  if (fromId instanceof Error) return next(fromId)
  if (!IdMap[fromId.collectionId]) {
    return next(proxErr.badValue('Invalid collectionId: ' + fromId.collectionId))
  }
  doc.fromCollectionId = fromId.collectionId

  var toId = parseId(doc._to)
  if (toId instanceof Error) return next(toId)
  if (!IdMap[toId.collectionId]) {
    return next(proxErr.badValue('Invalid collectionId: ' + toId.collectionId))
  }
  doc.toCollectionId = toId.collectionId

  next()
}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing link actions for link: ' + previous._id)
  this.db.actions.remove({_target:previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, links)
}
