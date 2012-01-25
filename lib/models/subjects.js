/*
 * Subjects model
 */

var Schema = require('./_base').Schema;

var Subjects = new Schema(86);

Subjects.add({
  classes: [ {type: String, ref: 'classes'} ]
});

exports.getSchema = function() {
  return Subjects;
}


