/*
 *  Sessions schema
 */

exports.schema = {
  id: 4,
  fields: {
    key:            { type: String, unique: true },
    expirationDate: { type: Number }
  }
}

