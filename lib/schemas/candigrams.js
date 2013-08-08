/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')

var candigram = {

  id: util.statics.collectionIds.candigrams,

  fields: {

    range:        { type: 'string' },
    timeout:      { type: 'number' },
    nudgeable:    { type: 'boolean' },
    captureable:  { type: 'boolean' },
    maxHops:      { type: 'number' },
    moveOnRead:   { type: 'boolean' },
    cloneOnLike:  { type: 'boolean' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, candigram)
}
