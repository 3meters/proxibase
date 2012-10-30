/*
 *  Entities schema
 */

var mongoose = require('mongoose')
  , Schema = require('../base').Schema
  , Entities = new Schema(2)
  , Comments = new mongoose.Schema({
      _creator:     { type: String, index: true, ref: 'users' },
      createdDate:  { type: Number },
      title:        { type: String },
      description:  { type: String },
      name:         { type: String },
      location:     { type: String },
      imageUri:     { type: String }
    })

Entities.add({
  _entity:                { type: String, index: true, ref: "entities" },
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
  comments:               [Comments]
})

Entities.pre('save', function(next) {
  /* preSave in base.js gets called before this */
  this.name = this.title
  this.namelc = this.title
  next()
})

exports.getSchema = function() {
  return Entities
}
