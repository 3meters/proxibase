/**
 *  Entities schema
 */

var util = require('util')
var mongo = require('..')
var base = require('./_base').get()
var comment = mongo.createSchema() // TODO: think through
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
  _entity:                { type: String, ref: 'entities' },
  type:                   { type: String, required: true },
  subtitle:               { type: String },
  description:            { type: String },
  signalFence:            { type: Number },
  isCollection:           { type: Boolean },
  locked:                 { type: Boolean },
  enabled:                { type: Boolean, default: true },
  visibility:             { type: String, default: 'public' },
  activityDate:           { type: Number },
  comments:               [comments]
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
  update: [setNames]
}

function setNames(doc, previous, options, next) {
  if (doc.title && !doc.name) doc.name = doc.title
  if (doc.name) doc.namelc = doc.name.toLowerCase()
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entities)
}
