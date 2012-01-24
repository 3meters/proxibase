/*
 * Clasess model
 */

var Schema = require('./_Base').Schema;

var Classes = new Schema(82);

Classes.add({
  room: { type: String }, 
  _subject: { type: String, ref: 'subjects' }
});

exports.Model = function(mdb) {
  return mdb.model('Classes', Classes);
}
