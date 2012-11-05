/*
 *  Sessions schema
 */

var schema = {
  id: 4,
  fields: {
    key:            { type: String },
    expirationDate: { type: Number }
  },
  indexes: [
    { index: 'key', options: { unique: true }}
  ]
}

exports.getSchema = function() {
  return schema
}

