/*
 * Students model
 */

var Schema = require('mongoose').Schema
var ObjectId = Schema.ObjectId;
var Student = require('./_BaseSchema');

Student.add({
  name:       { type: String },
  testProp:   { type: String, default: 'foobar' },
});


exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

