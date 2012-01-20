/*
 * Students model
 */

var Student = require('./_BaseSchema');

Student.schemaId = '88';

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

