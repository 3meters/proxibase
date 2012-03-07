/*
 *  Links model
 */

var
  Schema = require('../base').Schema,
  Links = new Schema(3)

Links.add({
  _from:  { type: String, required: true, index: true },
  _to:    { type: String, required: true, index: true }
})

exports.getSchema = function() {
  return Links
}

