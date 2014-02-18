/**
 *  Entities schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sMessage = statics.schemas.message

var message = {

  id: sMessage.id,
  name: sMessage.name,
  collection: sMessage.collection,

  fields: {
    lifetime:         { type: 'number' },                   // milliseconds
    forward:          { type: 'boolean', default: true },
    expired:          { type: 'boolean', default: false },
    expirationDate:   { type: 'number' },
  },

  indexes: [
    { index: 'expirationDate' },
  ],
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, message)
}
