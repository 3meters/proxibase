/**
 *  Messages schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sMessage = statics.schemas.message

var message = {

  id: sMessage.id,
  name: sMessage.name,
  collection: sMessage.collection,

  fields: {
    _root:            { type: 'string' },    // convenient way to track the root message from any depth
    _replyTo:         { type: 'string' },    // a user id so message replies can be show reply context
  },

}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, message)
}
