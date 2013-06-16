/**
 *  Beacons schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')

var beacon = {

  id: util.statics.collectionIds.beacons,

  fields: {
    ssid:         { type: 'string' },
    bssid:        { type: 'string', required: true },
    signal:       { type: 'number' },                         // signal level relative to location
  },

  indexes: [
    { index: 'bssid' },
  ],
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, beacon)
}
