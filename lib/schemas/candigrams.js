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
    duration:     { type: 'number' },
    nudge:        { type: 'boolean' },
    capture:      { type: 'boolean' },
    maxHops:      { type: 'number' },
    lastHopDate:  { type: 'number' },
    nextHopDate:  { type: 'number' },
    moveOnRead:   { type: 'boolean' },
    cloneOnLike:  { type: 'boolean' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, candigram)
}
