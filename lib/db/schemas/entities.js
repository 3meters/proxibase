/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../')
var base = require('./_base')
var comment = {} // TODO: think through
var source = {}
var entities = {}

entities.id = util.statics.collectionIds.entities

comment.fields = {
  _creator:     { type: String, ref: 'users' },  // TODO: make lookups work
  createdDate:  { type: Number },
  title:        { type: String },
  description:  { type: String },
  name:         { type: String },
  location:     { type: String },
  imageUri:     { type: String },
}

source.fields = {
  type:         { type: String },  // website, facebook, twitter, etc
  id:           { type: String },  // source provider's unique id
  name:         { type: String },  // name used for search
  hidden:       { type: Boolean }, // hide in client UI
  label:        { type: String },  // user editable display name
  url:          { type: String },  // browser url
  icon:         { type: String },  // small client display image
  packageName:  { type: String },  // android package name of related app
  data:         { type: String },  // data roundtripped but unknown to the client
}

entities.fields = {
  type:           { type: String, required: true },
  photo:          { type: Object },
  place:          { type: Object },
  sources:        { type: [ source ] },
  subtitle:       { type: String },
  description:    { type: String },
  signalFence:    { type: Number },
  isCollection:   { type: Boolean, default: false },
  locked:         { type: Boolean, default: false },
  enabled:        { type: Boolean, default: true },
  visibility:     { type: String, default: 'public' },
  loc:            { type: [ Number ] },
  activityDate:   { type: Number },
  comments:       { type: [ comment ] },
}

entities.indexes = [
  { index: '_entity' },
  { index: 'enabled', },
  { index: 'visibility' },
  { index: 'activityDate' },
  { index: {loc: '2d'} },
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
