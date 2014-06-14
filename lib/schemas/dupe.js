/**
 *  Dupe places schema
 */

var mongo = require('../db')
var base = require('./_base')
var sDupe = statics.schemas.dupe

var dupe = {

  id: sDupe.id,
  name: sDupe.name,
  collection: sDupe.collection,

  fields: {
    saved:    { type: 'boolean'},
    _place:   { type: 'string', ref: 'places' },
  },

}

exports.getSchema = function() {
  return mongo.createSchema(base, dupe)
}
