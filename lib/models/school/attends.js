/*
 * Attends schema
 */
var Schema = require('../base').Schema;
var Attends = new Schema(3);

Attends.add({
  _student: { type: String, ref: 'students' },
  _class: { type: String, ref: 'classes' },
  year: { type: Number },
  semester: { type: String }
});


exports.getSchema = function() {
  return Attends;
}

