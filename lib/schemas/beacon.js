/**
 *  Beacons schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sBeacon = util.statics.schemas.beacon

var beacon = {

  id: sBeacon.id,
  name: sBeacon.name,
  collection: sBeacon.collection,

  fields: {
    ssid:         { type: 'string' },
    bssid:        { type: 'string', required: true },
    signal:       { type: 'number' },                         // signal level relative to location
  },

  validators: {
    init: [setAdminOwns]
  },

  indexes: [
    { index: 'bssid' },
  ],

  methods: {
    genId: genId,
  }
}

function setAdminOwns(doc, previous, options, next) {
  options.adminOwns = true
  next()
}

// Override the _base genId function with one that uses
// the bssid of the beacon
function genId(doc) {
  if (!doc.bssid) return perr.missingParam('bssid')
  return this.schema.id + '.' + doc.bssid
}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, beacon)
}
