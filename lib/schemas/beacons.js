/**
 * Beacons schema
 */

var mongo = require('../db')
var base = require('./_base')
var beacons = {}

beacons.id = util.statics.collectionIds.beacons

beacons.fields = {
  ssid:           { type: 'string' },
  bssid:          { type: 'string', required: true },
  type:           { type: 'string', default: 'fixed' },       // fixed, mobile
  level:          { type: 'number' },                         // signal level relative to location
  location:       { type: 'object', value: types.location },  
  loc:            { type: 'array', value: {type: 'number'} }, // system field
}

beacons.indexes = [
  { index: 'bssid' },
  { index: {loc: '2d', type: 1} },
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
  if (doc.longitude && doc.latitude) {
    delete doc.loc
    doc.loc = [doc.longitude, doc.latitude]
  }
  if (doc.bssid) {
    doc.name = doc.bssid
    doc.namelc = doc.name.toLowerCase()
  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, beacons)
}
