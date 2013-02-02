/**
 * Beacons schema
 */

var util = require('utils')
var mongo = require('..')
var base = require('./_base')
var beacons = {}

beacons.id = util.statics.collectionIds.beacons

beacons.fields = {
  ssid:           { type: String },
  bssid:          { type: String, required: true },
  label:          { type: String },
  locked:         { type: Boolean },
  visibility:     { type: String, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  latitude:       { type: Number },
  longitude:      { type: Number },
  altitude:       { type: Number },
  accuracy:       { type: Number },
  bearing:        { type: Number },
  speed:          { type: Number },
  level:          { type: Number },
  loc:            { type: [ Number ] },
  activityDate:   { type: Number }
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
