/*
 * Students model
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema
var ObjectId = Schema.ObjectId;

function exists(v) {
  return v && v.length;
}

var Student = new Schema({
  name:           { type: String },
  owner:          { type: ObjectId, },
  created:        { type: Date, default: Date.now() },
  createdBy:      { type: ObjectId },
  lastModified:   { type: Date, default: Date.now() },
  lastModifiedBy: { type: ObjectId }
});

Student.virtual('id')
  .get(function() {
    return this._id;
  });

Student.method('serialize', function() {
  var self = this;
  self.newProperty = "foo";
  return self;
});

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

