/*
 *  Comments model
 */

var 
  Schema = require('../base').Schema,
  Comments = new Schema(4)

Comments.add({
  _entity:        { type: String, index: true, ref: "entities" },
  title:          { type: String },
  description:    { type: String }
})

exports.getSchema = function() {
  return Comments
}

