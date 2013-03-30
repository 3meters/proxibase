/**
 * Beacons schema
 */

var mongo = require('../')
var base = require('./_base')
var beacons = {}

beacons.id = util.statics.collectionIds.beacons

beacons.fields = {
  ssid:           { type: 'string' },
  bssid:          { type: 'string', required: true },
  label:          { type: 'string' },
  locked:         { type: 'boolean' },
  visibility:     { type: 'string', default: 'public' },
  beaconType:     { type: 'string', default: 'fixed' },
  latitude:       { type: 'number' },
  longitude:      { type: 'number' },
  altitude:       { type: 'number' },
  accuracy:       { type: 'number' },
  bearing:        { type: 'number' },
  speed:          { type: 'number' },
  level:          { type: 'number' },
  loc:            { type: 'array', value: {type: 'number'} },
  activityDate:   { type: 'number' }
}

beacons.indexes = [
  { index: 'bssid' },
  { index: 'visibility' },
  { index: {loc: '2d'} },
  { index: 'activityDate' }
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
