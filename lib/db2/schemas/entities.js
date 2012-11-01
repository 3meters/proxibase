/*
 *  Entities schema
 */

var comment = {
  _creator:     { type: String, ref: 'users' },  // TODO:  make work
  createdDate:  { type: Number },
  title:        { type: String },
  description:  { type: String },
  name:         { type: String },
  location:     { type: String },
  imageUri:     { type: String }
}

var schema = {
  id: 2,
  fields: {
    _entity:                { type: String, index: true, ref: 'entities' },
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
    linkZoom:               { type: Boolean, default: false },
    linkJavascriptEnabled:  { type: Boolean, default: false },
    signalFence:            { type: Number },
    locked:                 { type: Boolean, default: false },
    enabled:                { type: Boolean, index: true, default: true },
    visibility:             { type: String, index: true, default: 'public' },
    activityDate:           { type: Number, index: true },
    comments:               [comment]
  },
  indexes: {
    // comments._creator: false  // TODO:  make work
  }
}

schema.validators = {
  insert: [setNames],
  update: [setNames]
}

function setNames(doc, previous, options, next) {
  doc.name = doc.title
  doc.namelc = doc.title.toLowerCase()
  next()
}

exports.schema = schema
