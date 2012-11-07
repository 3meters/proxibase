/**
 *  Entities schema
 */

var util = require('util')
var mongodb = require('mongodb')
var entities = Object.create(mongodb.schema)
var comment = Object.create(mongodb.schema)

entities.id = util.statics.collectionIds.entities

comment.fields = {
  _creator:     { type: String, ref: 'users' },  // TODO: make lookup work
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
  root:                   { type: Boolean, default: false },
  uri:                    { type: String },
  label:                  { type: String },
  title:                  { type: String },
  subtitle:               { type: String },
  description:            { type: String },
  imageUri:               { type: String },
  imagePreviewUri:        { type: String },
  linkUri:                { type: String },
  linkPreviewUri:         { type: String },
  linkZoom:               { type: Boolean },
  linkJavascriptEnabled:  { type: Boolean },
  signalFence:            { type: Number },
  locked:                 { type: Boolean },
  enabled:                { type: Boolean, default: true },
  visibility:             { type: String, default: 'public' },
  activityDate:           { type: Number, },
  comments:               [comment]
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
  doc.name = doc.title
  doc.namelc = doc.title.toLowerCase()
  next()
}

exports._getSchema = function() {
  return entities
}
