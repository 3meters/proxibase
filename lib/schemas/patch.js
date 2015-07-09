/**
 *  Patches schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')
var staticPatch = statics.schemas.patch
var admin = util.adminUser

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

  documents: [
    statics.welcomePatch  // Tips and Tricks patch for autowatching on user create
  ],

  before: {
    read:   [promoteSystemFields],
    insert: [addWatchLink],
  },
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


// Non admin users automatically watch patches they create
function addWatchLink(doc, previous, options, next) {
  if (options.user._id === admin._id) return next()
  options.links = options.links || []
  var hasWatchLink = options.links.some(function(link) {
    return (link._from === options.user._id && link.type === 'watch')
  })
  if (!hasWatchLink) {
    options.links.push({_from: options.user._id, type: 'watch'})
  }
  next()
}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, patch)
}
