/**
 * Beacons schema
 */

var util = require('util')
var mongodb = require('mongodb')
var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/
var beacons = Object.create(mongodb.schema)

beacons.id = util.statics.collectionIds.beacons

beacons.fields = {
  ssid:           { type: String },
  bssid:          { type: String },
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
  insert: calcComputedFields,
  update: calcComputedFields
}


function calcComputedFields(doc, previous, options, next) {
  delete doc.loc
  if (doc.longitude && doc.latitude) {
    doc.loc = [doc.longitude, doc.latitude]
  }
  if (doc.bssid) {
    doc.name = doc.bssid
    doc.namelc = doc.name.toLowerCase()
  }
  next()
}

exports.getSchema = function() {
  return beacons
}
