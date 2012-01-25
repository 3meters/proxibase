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

console.dir(Attends);
exports.getSchema = function() {
  return Attends;
}

