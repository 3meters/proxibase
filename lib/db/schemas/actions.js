/*
 * Actions schema
 *
 * type (verb): tune, edit, browse
 * _target (noun): internal or external identifier  
 * targetSource: aircandi, foursquare
 * targetTableId: schema id if source is aircandi
 */

var util = require('util')
var parseId = util.parseId
var mongo = require('..')
var base = require('./_base')
var actions = {}

actions.fields = {
  _target:          { type: String, required: true },
  targetSource:     { type: String },
  targetTableId:    { type: Number },
  type:             { type: String, required: true }
}

actions.indexes = [
  {index: '_target'},
  {index: 'targetTableId'}
]

actions.validators = {
  insert: [setTarget],
  update: [setTarget]
}

function setTarget(doc, previous, options, next) {
  var targetId = parseId(doc._target)
  if (targetId instanceof Error) return next(targetId)
  doc.targetTableId = targetId.collectionId
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, actions)
}
