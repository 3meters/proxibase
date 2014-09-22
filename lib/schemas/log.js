/**
/**
 *  Log schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var schema = statics.schemas.log

var logSchema = {
  id: schema.id,
  name: schema.name,
  collection: schema.collection,

  fields: {
    category:    { type: 'string', required: true },      // timing, event
    name:        { type: 'string', required: true },      // beacon_search, location_lock
    label:       { type: 'string' },                      // as needed
    value:       { type: 'number' },                      // 0.567
  }
}

exports.getSchema = function() {
  return mongo.createSchema(base, logSchema)
}
