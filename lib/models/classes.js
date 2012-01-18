/*
 * Clasess model
 */

var Class = require('./_BaseSchema');

Class.index = '99'; 

Class.add({
  subject: { type: String }
});

exports.Model = function(mdb) {
  return mdb.model('Classes', Class);
}
