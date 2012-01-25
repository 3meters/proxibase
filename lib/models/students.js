/*
 * Students model
 */

var Schema = require('./_base').Schema;

var Students = new Schema(84);

Students.add({
  gender: { type: String }
});

exports.getSchema = function() {
  return Students;
}
