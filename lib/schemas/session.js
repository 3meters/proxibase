/**
 *  Sessions schema
 */

var mongo = require('../db')
var base = require('./_base')
var sSession = util.statics.schemas.session

var session = {

  id: sSession.id,
  name: sSession.name,
  collection: sSession.collection,

  system: true, // means rest apis will require admin permissions to read

  fields: {
    key:            { type: 'string' },
    expirationDate: { type: 'number' }
  },

  indexes: [
    { index: 'key', options: { unique: true }}
  ],
}

exports.getSchema = function() {
  return mongo.createSchema(base, session)
}