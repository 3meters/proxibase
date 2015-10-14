/**
 *  Beacons schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var location = require('./_location')
var sBeacon = statics.schemas.beacon

var beacon = {

  id: sBeacon.id,
  name: sBeacon.name,
  collection: sBeacon.collection,
  ownerAccess: false,

  fields: {
    ssid:         { type: 'string' },
    bssid:        { type: 'string', required: true },
    signal:       { type: 'number', deprecated: true },               // signal level relative to location
  },

  before: {
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
  return mongo.createSchema(base, location, beacon)
}
