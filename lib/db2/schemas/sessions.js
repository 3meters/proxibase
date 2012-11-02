/*
 *  Sessions schema
 */

var schema = {
  id: 4,
  fields: {
    key:            { type: String, unique: true },
    expirationDate: { type: Number }
  }
}

exports.getSchema = function() {
  return schema
}

