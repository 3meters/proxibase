/**
 *  Beacons schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')

var beacon = {

  collection: {
    id: '0201',
    name: 'com.aircandi.entity.beacons',
  },

  fields: {
    beacon:       { type: 'object', value: {
      ssid:         { type: 'string' },
      bssid:        { type: 'string', required: true },
      signal:       { type: 'number' },                         // signal level relative to location
    }},
  },

  indexes: [
    { index: 'beacon.bssid' },
  ],
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, beacon)
}
