/*
 * Actions schema
 *
 * type (verb): tune, edit, browse
 * _target (noun): internal or external identifier  
 * targetSource: aircandi, foursquare
 * targetTableId: schema id if source is aircandi
 */

var parseId = util.parseId
var mongo = require('..')
var base = require('./_base')
var actions = {}

actions.fields = {
  _target:          { type: String, required: true },
  _user:            { type: String, required: true },
  type:             { type: String, required: true },
  targetSource:     { type: String },
  targetCollectionId:    { type: String }
}

actions.indexes = [
  {index: '_target'},
  {index: 'targetCollectionId'}
]

actions.validators = {
  insert: [setTarget],
  update: [setTarget]
}

function setTarget(doc, previous, options, next) {
  var targetId = parseId(doc._target)
  if (targetId instanceof Error) return next(targetId)
  doc.targetCollectionId = targetId.collectionId
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, actions)
}
