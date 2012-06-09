/*
 *  Sessions model
 */

var
  Schema = require('../base').Schema,
  Sessions = new Schema(4)

Sessions.add({
  key: { type: String, unique: true }
})

exports.getSchema = function() {
  return Sessions
}

