/**
 *  Sys schema:  manage system data.
 *     Used by state manager and _linkStats
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sSys = statics.schemas.sys

var sys = {
  id: sSys.id,
  name: sSys.name,
  collection: sSys.collection,
  system: true,

  fields: {
    enabled:      { type: 'boolean', default: true }, // used to control tasks
  },

  indexes: [
    {index: 'name'},
  ],

}

exports.getSchema = function() {
  return mongo.createSchema(base, sys)
}
