/**
 *  Dupe patches schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sDupe = statics.schemas.dupe

var dupe = {

  id: sDupe.id,
  name: sDupe.name,
  collection: sDupe.collection,

  fields: {
    saved:    { type: 'boolean'},
    _patch:   { type: 'string', ref: 'patches' },
  },

}

exports.getSchema = function() {
  return mongo.createSchema(base, dupe)
}
