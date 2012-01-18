/*
 * Students model
 */

var Student = require('./_BaseSchema');

Student.index = '88';

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

