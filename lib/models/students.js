/*
 * Students model
 */

var Schema = require('./_Base').Schema;

var Students = new Schema(84);

Students.add({
  gender: { type: String }
});

exports.Model = function(mdb) {
  return mdb.model('Students', Students);
}
