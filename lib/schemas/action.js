/*
 * Actions schema
 */

var parseId = util.parseId
var mongo = require('../db')
var base = require('./_base')
var sAction = util.statics.schemas.action

var action = {
  /*
   * [_user] did [event] to [_entity]
   */
  id: sAction.id,
  name: sAction.name,
  collection: sAction.collection,
  system: false,  // BUG: should be true

  fields: {
    event:              { type: 'string', required: true },                   // action event: like_post, watch_place, etc.
    _user:              { type: 'string', required: true, ref: 'users' },     // user causing the action
    _entity:            { type: 'string', required: true, ref: 'entities' },  // entity targeted by action
    _toEntity:          { type: 'string', ref: 'entities' },                  // entity also effected by action
    _fromEntity:        { type: 'string', ref: 'entities'},                   // entity also effected by action
  },

  indexes: [
    {index: { _entity: 1, event: 1 }},  // More efficient for countBy queries, $or operations
    {index: { _user: 1, event: 1 }},    // More efficient for countBy queries, $or operations
    {index: { _toEntity: 1 }},          // Used in $or operations
  ],

}

exports.getSchema = function() {
  return mongo.createSchema(base, action)
}
