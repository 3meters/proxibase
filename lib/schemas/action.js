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
var sAction = util.statics.schemas.action

var action = {
  /* 
   * [_user] did [type] to [_target] 
   */
  id: sAction.id,
  name: sAction.name,
  collection: sAction.collection,

  fields: {
    _target:            { type: 'string', required: true },               // target id
    _user:              { type: 'string', required: true, ref: 'users' },
    type:               { type: 'string', required: true },               // like_post, watch_place, etc.
    targetCollection:   { type: 'string' }
  },

  indexes: [
    {index: '_target'},
    {index: 'targetCollection'}
  ],

  validators: {
    insert: [setTarget],
    update: [setTarget]
  }
}


function setTarget(doc, previous, options, next) {
  var targetId = parseId(doc._target)
  if (targetId instanceof Error) return next(targetId)
  doc.targetCollection = targetId.collectionName
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, action)
}
