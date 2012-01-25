/*
 * Clasess model
 */

var Schema = require('./_base').Schema;

var Classes = new Schema(82);

Classes.add({
  room: { type: String }, 
  _subject: { type: String, ref: 'subjects' }
});

exports.getSchema = function() {
  return Classes;
}
