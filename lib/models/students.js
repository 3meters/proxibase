/*
 * Students model
 */

var Student = require('./_BaseSchema');

Student.add({
  name: { type: String },
});

exports.Model = function(mdb) {
  return mdb.model('Students', Student);
}

