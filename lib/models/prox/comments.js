/*
 *  Comments model
 */

var Schema = require('../base').Schema;
var Comments = new Schema(4);
var log = require('../../util').log;

Comments.add({
  _entity:        { type: String, index: true, ref: "entities" },
  title:          { type: String, required: true },
  description:    { type: String }
});

exports.getSchema = function() {
  return Comments;
}

