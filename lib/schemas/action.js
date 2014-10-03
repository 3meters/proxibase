/*
 * Actions schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sAction = statics.schemas.action

var action = {
  /*
   * [_user] did [event] to [_entity]
   */
  id: sAction.id,
  name: sAction.name,
  collection: sAction.collection,
  system: true,

  fields: {
    event:              { type: 'string', required: true },                   // action event: like_post, watch_place, etc.
    _user:              { type: 'string', required: true, ref: 'users' },     // user causing the action
    _entity:            { type: 'string', required: true, },                  // entity targeted by action
    _toEntity:          { type: 'string' },                                   // entity also effected by action
    _acl:               { type: 'string' },                                   // ambient place identifier if available
  },

  indexes: [
    {index: { _entity: 1, event: 1 }},  // More efficient for countBy queries, $or operations
    {index: { _user: 1, event: 1 }},    // More efficient for countBy queries, $or operations
    {index: { _toEntity: 1 }},          // Used in $or operations
    {index: { _acl: 1 }},             // Used when searching for actions related to a place even if place is not directly part of the action
  ],

}

exports.getSchema = function() {
  return mongo.createSchema(base, action)
}
