/**
 *  Entities schema
 */

var util = require('util')
var mongo = require('..')
var base = require('./_base')
var comment = {} // TODO: think through
var entities = {}

entities.id = util.statics.collectionIds.entities

comment.fields = {
  _creator:     { type: String, ref: 'users' },  // TODO: make lookups work
  createdDate:  { type: Number },
  title:        { type: String },
  description:  { type: String },
  name:         { type: String },
  location:     { type: String },
  imageUri:     { type: String }
}

entities.fields = {
  _entity:        { type: String, ref: 'entities' },
  type:           { type: String, required: true },
  photo:          { type: Object },
  place:          { type: Object },
  subtitle:       { type: String },
  description:    { type: String },
  signalFence:    { type: Number },
  isCollection:   { type: Boolean },
  locked:         { type: Boolean },
  enabled:        { type: Boolean, default: true },
  visibility:     { type: String, default: 'public' },
  activityDate:   { type: Number },
  comments:       { type: [ comment ] }
}

entities.indexes = [
  { index: '_entity' },
  { index: 'enabled', },
  { index: 'visibility' },
  { index: 'activityDate' },
  { index: 'comments._creator' }
]

entities.validators = {
  insert: [setNames],
  update: [setNames, appendComments]
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

exports.getSchema = function() {
  return mongo.createSchema(base, entities)
}
