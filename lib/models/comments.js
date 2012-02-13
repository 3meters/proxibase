/*
 *  Comments model
 */

var Schema = require('./_base').Schema;
var Comments = new Schema(4);
var log = require('../log');

Comments.add({
  _entity:        { type: String, index: true, ref: "entities" },
  title:          { type: String, required: true },
  description:    { type: String }
});

exports.getSchema = function() {
  return Comments;
}

