/*
 *  Documents model
 */

var 
  Schema = require('../base').Schema,
  Documents = new Schema(5)

exports.getSchema = function() {
  return Documents
}
