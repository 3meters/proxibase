/*
 * Attends schema
 */
var Schema = require('./_base').Schema;
var Attends = new Schema(80);

Attends.add({
  _student: { type: String, ref: 'students' },
  _class: { type: String, ref: 'classes' },
  year: { type: Number },
  semester: { type: String }
});

// require('../log').(Attends, 4);

exports.getSchema = function() {
  return Attends;
}

