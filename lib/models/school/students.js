/*
 * Students model
 */

var Schema = require('../base').Schema;
var Students = new Schema(1);

Students.add({
  gender: { type: String }
});

exports.getSchema = function() {
  return Students;
}
