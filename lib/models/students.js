/*
 * Students model
 */

var Schema = require('mongoose').Schema
var ObjectId = Schema.ObjectId;
var _ = require('underscore');
var BaseSchema = require('./_BaseSchema');

var Student = new Schema({
  name:           { type: String },
  owner:          { type: ObjectId, },
  created:        { type: Number, default: Date.now() },
  createdBy:      { type: ObjectId },
  lastModified:   { type: Number, default: Date.now() },
  lastModifiedBy: { type: ObjectId }
});

_.extend(Student, BaseSchema); 

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

