/**
 *  Sessions schema
 */

var mongo = require('../')
var base = require('./_base')
var sessions = {}

sessions.id = util.statics.collectionIds.sessions

sessions.system = true // means rest apis will require admin permissions to read

sessions.fields = {
  key:            { type: 'string' },
  expirationDate: { type: 'number' }
}

sessions.indexes = [
  { index: 'key', options: { unique: true }}
]

exports.getSchema = function() {
  return mongo.createSchema(base, sessions)
}

