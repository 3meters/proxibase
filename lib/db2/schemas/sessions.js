/**
 *  Sessions schema
 */

var util = require('util')
var mongodb = require('mongodb')
var sessions = Object.create(mongodb.schema)

sessions.id = util.statics.collectionIds.links

sessions.fields = {
  key:            { type: String },
  expirationDate: { type: Number }
}

sessions.indexes = [
  { index: 'key', options: { unique: true }}
]

exports.getSchema = function() {
  return sessions
}

