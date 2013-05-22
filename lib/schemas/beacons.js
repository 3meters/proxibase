/**
 * Beacons schema
 */

var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var beacons = {}

beacons.id = util.statics.collectionIds.beacons

beacons.fields = {
  ssid:           { type: 'string' },
  bssid:          { type: 'string', required: true },
  type:           { type: 'string', default: 'fixed' },       // fixed, mobile
  level:          { type: 'number' },                         // signal level relative to location
}

beacons.indexes = [
  { index: 'bssid' },
]

beacons.validators = {
  insert: [ genId, calcComputedFields ],
  update: [ calcComputedFields ]
}

function genId(doc, previous, options, next) {
  if (!doc.bssid) return next(proxErr.missingParam('bssid'))
  doc._id = util.statics.collectionIds.beacons + '.' + doc.bssid
  next()
}

function calcComputedFields(doc, previous, options, next) {
  if (doc.bssid) {
    doc.name = doc.bssid
    doc.namelc = doc.name.toLowerCase()
  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, beacons)
}
