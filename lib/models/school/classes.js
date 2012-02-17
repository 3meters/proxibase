/*
 * Clasess model
 */

var Schema = require('../base').Schema;
var Classes = new Schema(2);

Classes.add({
  room: { type: String }, 
  _subject: { type: String, ref: 'subjects' }
});

exports.getSchema = function() {
  return Classes;
}
