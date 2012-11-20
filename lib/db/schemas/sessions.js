/**
 *  Sessions schema
 */

var util = require('util')
var mongo = require('..')
var base = require('./_base').get()
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

