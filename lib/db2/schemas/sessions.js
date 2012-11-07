/**
 *  Sessions schema
 */

var util = require('util')
var mongodb = require('mongodb')
var base = require('./_base').get()
var sessions = mongodb.createSchema()

sessions.id = util.statics.collectionIds.sessions

sessions.fields = {
  key:            { type: String },
  expirationDate: { type: Number }
}

sessions.indexes = [
  { index: 'key', options: { unique: true }}
]

exports._getSchema = function() {
  return mongodb.createSchema(base, sessions)
}

