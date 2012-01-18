/*
 * Subjects model
 */

var Subjects = require('./_BaseSchema');

exports.Model = function(mdb) {
  return mdb.model('Subjects', Subjects);
}


