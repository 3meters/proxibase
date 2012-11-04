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
  uri:                    { type: String },
  subtitle:               { type: String },
  description:            { type: String },
  signalFence:            { type: Number },
  locked:                 { type: Boolean, default: false },
  enabled:                { type: Boolean, index: true, default: true },
  visibility:             { type: String, index: true, default: 'public' },
  activityDate:           { type: Number, index: true },
  comments:               [Comments]
})

exports.getSchema = function() {
  return Entities
}
