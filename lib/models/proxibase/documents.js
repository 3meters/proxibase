/*
 *  Documents model
 */

var 
  Schema = require('../base').Schema,
  Documents = new Schema(5)

Documents.add({
  type:        { type: String, index: true }
})

exports.getSchema = function() {
  return Documents
}
