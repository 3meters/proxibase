/**
 *  Patches schema
 */

var mongo = require('../mongosafe')
var fuzzy = require('fuzzy')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')
var staticPatch = statics.schemas.patch

var patch = {

  id: staticPatch.id,
  name: staticPatch.name,
  collection: staticPatch.collection,

  fields: {

    category:    { type: 'object', value: {
      id:               { type: 'string' },
      name:             { type: 'string' },
      photo:            { type: 'object', value: photo.fields},
    }},

  },

  indexes: [
    { index: { name: 'text', 'category.name': 'text'},
        options: { weights: { name: 10, 'category.name': 4 }}},
  ],

}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, patch)
}
