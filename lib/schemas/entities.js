/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var comment = {} // TODO: think through
var source = {}
var entities = {}

entities.id = util.statics.collectionIds.entities

comment.fields = {
  _creator:     { type: 'string', ref: 'users' },  // TODO: make lookups work
  createdDate:  { type: 'number' },
  title:        { type: 'string' },
  description:  { type: 'string' },
  name:         { type: 'string' },
  location:     { type: 'string' },
  imageUri:     { type: 'string' },
}

source.fields = {
  type:         { type: 'string' },  // website, facebook, twitter, etc
  id:           { type: 'string' },  // source provider's unique id
  name:         { type: 'string' },  // name used for search
  system:       { type: 'boolean' }, // round-trip but do not display in UI
  label:        { type: 'string' },  // user editable display name
  url:          { type: 'string' },  // browser url
  icon:         { type: 'string' },  // small client display image
  packageName:  { type: 'string' },  // android package name of related app
  data:         { type: 'object' },  // data roundtripped but unknown to the client
}

entities.fields = {
  type:           { type: 'string', required: true },
  photo:          { type: 'object' },
  place:          { type: 'object' },
  sources:        { type: 'array', value: source.fields },
  subtitle:       { type: 'string' },
  description:    { type: 'string' },
  signalFence:    { type: 'number' },
  isCollection:   { type: 'boolean' },
  locked:         { type: 'boolean' },
  enabled:        { type: 'boolean' },
  visibility:     { type: 'string', default: 'public' },
  loc:            { type: 'array', value: {type: 'number'} },
  activityDate:   { type: 'number' },
  comments:       { type: 'array', value: comment.fields },
}

entities.indexes = [
  { index: '_entity' },
  { index: 'enabled', },
  { index: 'visibility' },
  { index: 'activityDate' },
  { index: {loc: '2d', type: 1} },
  { index: 'comments._creator' },
]

entities.validators = {
  insert: [setNames, calcComputedFields],
  update: [setNames, calcComputedFields, appendComments],
  remove: [removeActions],
}

function setNames(doc, previous, options, next) {
  if (doc.name) doc.namelc = doc.name.toLowerCase()
  next()
}

// This is inefficient if there are ever a lot of comments, but it is simple
function appendComments(doc, previous, options, next) {
  if (doc.comments && previous.comments) {
    doc.comments = previous.comments.concat(doc.comments)
  }
  next()
}

function calcComputedFields(doc, previous, options, next) {
  if (doc.place && doc.place.location) {
    if (doc.place.location.lat && doc.place.location.lng) {
      delete doc.loc
      doc.loc = [doc.place.location.lng, doc.place.location.lat]
    }
  }
  next()
}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing entity actions for entity: ' + previous._id)
  this.db.actions.remove({_target:previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, entities)
}
