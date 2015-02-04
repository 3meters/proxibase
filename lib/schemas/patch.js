/**
 *  Patches schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')
var staticPatch = statics.schemas.patch

var patch = {

  id: staticPatch.id,
  name: staticPatch.name,
  collection: staticPatch.collection,
  ownerAccess: false,   // public

  fields: {
    locked:       { type: 'boolean' },
    visibility:   { type: 'string', default: 'public', value: 'public|private' },
    restricted:   { type: 'boolean', default: false, value: function() {
      return (this.visibility === 'private' || this.locked)
    }},
    category:    { type: 'object', value: {
      id:               { type: 'string' },
      name:             { type: 'string' },
      photo:            { type: 'object', value: photo.fields},
    }},
  },

  indexes: [
    { index: { name: 'text', 'category.name': 'text', description: 'text' },
        options: { weights: { name: 10, 'category.name': 5 }}},
  ],

  before: {
    read:   [promoteSystemFields],
  }
}


// We need the visibility and restricted fields in order to check
// permissions.  Promote them to mandatory even if the caller
// specified a field list that did not include them.
function promoteSystemFields(query, options, next) {
  if (options.fields && !_.isEmpty(options.fields)) {
    options.fields.visibility = 1
    options.fields.restricted = 1
  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, patch)
}
