/*
 * Actions schema
 *
 * type (verb): tune, edit, browse
 * _target (noun): internal or external identifier  
 * targetSource: aircandi, foursquare
 * targetTableId: schema id if source is aircandi
 */

var parseId = util.parseId
var mongo = require('../db')
var base = require('./_base')
var actions = {}

actions.fields = {
  _target:            { type: 'string', required: true },
  _user:              { type: 'string', required: true, ref: 'users' },
  type:               { type: 'string', required: true },
  targetSource:       { type: 'string' },
  targetCollectionId: { type: 'string' }
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
