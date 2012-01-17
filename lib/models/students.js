/*
 * Students model
 */

var Schema = require('mongoose').Schema
var ObjectId = Schema.ObjectId;
var _ = require('underscore');
var baseSchema = require('./_BaseSchema');


var Student = new Schema({
  name:       { type: String },
  testProp:   { type: String, default: 'foobar' },
  owner:      { type: ObjectId },
  created:    { type: Number, default: Date.now() },
  createdBy:  { type: ObjectId },
  changed:    { type: Number, default: Date.now() },
  changedBy:  { type: ObjectId }
});

Student.statics = baseSchema.statics;

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

