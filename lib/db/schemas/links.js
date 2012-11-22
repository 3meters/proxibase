/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var util = require('util')
var db = util.db
var parseId = util.parseId
var mongo = require('..')
var base = require('./_base')
var links = {}

links.id = util.statics.collectionIds.links

links.fields = {
  _from:        { type: String, required: true },
  _to:          { type: String, required: true },
  fromTableId:  { type: Number },
  toTableId:    { type: Number },
  primary:      { type: Boolean },
  signal:       { type: Number }
}

links.indexes = [
  { index: '_from' },
  { index: '_to' },
  { index: {_from: 1, _to: 1}, options: {unique: true}}
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
  doc.fromTableId = fromId.collectionId

  var toId = parseId(doc._to)
  if (toId instanceof Error) return next(toId)
  if (!IdMap[toId.collectionId]) {
    return next(proxErr.badValue('Invalid collectionId: ' + toId.collectionId))
  }
  doc.toTableId = toId.collectionId

  next()
}

function removeActions(doc, previous, options, next) {
  // /* We remove them so user can't spam by create/delete/create. */
  // db.actions.remove({_target:doc._id}, {safe:true}, function(err) {
  //   if (err) return next(err)
    next()
  // })
}

exports.getSchema = function() {
  return mongo.createSchema(base, links)
}
