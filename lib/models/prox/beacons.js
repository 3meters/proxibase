/*
/*
 * Beacons model
 */
var 
  Schema = require('../base').Schema,
  Beacons = new Schema(1),
  log = require('../../util').log


var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/

Beacons.add({
  ssid:           { type: String, },
  bssid:          { type: String, index: true },
  label:          { type: String, },
  _beaconSet:     { type: String, index: true, ref: 'beaconsets' },
  locked:         { type: Boolean, default: false },
  visibility:     { type: String, index: true, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  latitude:       { type: Number },
  longitude:      { type: Number },
  altitude:       { type: Number },
  accuracy:       { type: Number },
  bearing:        { type: Number },
  speed:          { type: Number }
})

Beacons.path('bssid').required(true).validate(macAddressRE, "Name must be a valid mac address")

Beacons.pre('save', function(next) {
  // this.name = this.bssid  // disabled until data has been transferred over
  next()
})

exports.getSchema = function() {
  return Beacons
}
