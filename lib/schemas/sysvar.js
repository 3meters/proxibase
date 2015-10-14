/**
 *  Sysvars schema:  manage system state variables that are shared
 *    across the cluster by the state manager.  Can also
 *    be written to directly.  Used by _linkstat
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sSysvar = statics.schemas.sysvar

var sysvar = {
  id: sSysvar.id,
  name: sSysvar.name,
  collection: sSysvar.collection,
  system: true,

  fields: {
    enabled:      { type: 'boolean', default: true }, // used to control tasks
  },

  indexes: [
    {index: 'name'},
  ],

}

exports.getSchema = function() {
  return mongo.createSchema(base, sysvar)
}
