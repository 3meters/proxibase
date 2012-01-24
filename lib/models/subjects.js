/*
 * Subjects model
 */

var Schema = require('./_Base').Schema;

var Subjects = new Schema(86);

Subjects.add({
  classes: [ {type: String, ref: 'classes'} ]
});

exports.Model = function(mdb) {
  return mdb.model('Subjects', Subjects);
}


