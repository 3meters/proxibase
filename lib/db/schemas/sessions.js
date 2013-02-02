/**
 *  Sessions schema
 */

var util = require('utils')
var mongo = require('..')
var base = require('./_base')
var sessions = {}

sessions.id = util.statics.collectionIds.sessions

sessions.fields = {
  key:            { type: String },
  expirationDate: { type: Number }
}

sessions.indexes = [
  { index: 'key', options: { unique: true }}
]

exports.getSchema = function() {
  return mongo.createSchema(base, sessions)
}

