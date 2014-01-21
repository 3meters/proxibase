/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sMessage = util.statics.schemas.message

var message = {

  id: sMessage.id,
  name: sMessage.name,
  collection: sMessage.collection,

  fields: {
    lifetime:     { type: 'number' },                   // milliseconds
    forward:      { type: 'boolean', default: true },
    expired:      { type: 'boolean', default: false },
    _place:       { type: 'string' },
  },

}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, message)
}
