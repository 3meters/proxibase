/*
 * Attends schema
 */
var Schema = require('./_Base').Schema;
var Attends = new Schema(80);

Attends.add({
  _student: { type: String, ref: 'students' },
  _class: { type: String, ref: 'classes' },
  year: { type: Number },
  semester: { type: String }
});

exports.Model = function(mdb) {
  return mdb.model('Attends', Attends);
}

