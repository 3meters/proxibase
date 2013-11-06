/*
 * Actions schema
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
    type:               { type: 'string', required: true },                   // action type: like_post, watch_place, etc.
    _user:              { type: 'string', required: true, ref: 'users' },     // user causing the action
    _target:            { type: 'string', required: true, ref: 'entities' },  // entity targeted by action
    _toEntity:          { type: 'string', ref: 'entities' },                  // entity also effected by action
    _fromEntity:        { type: 'string', ref: 'entities'},                   // entity also effected by action
  },

  indexes: [
    {index: '_target'},
  ],

}

exports.getSchema = function() {
  return mongo.createSchema(base, action)
}
