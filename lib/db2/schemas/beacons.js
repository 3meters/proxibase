/*
/*
 * Beacons schema
 */
var Schema = require('../base').Schema
  , Beacons = new Schema(3)


var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/

Beacons.add({
  ssid:           { type: String, },
  bssid:          { type: String, index: true },
  label:          { type: String, },
  locked:         { type: Boolean, default: false },
  visibility:     { type: String, index: true, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  latitude:       { type: Number },
  longitude:      { type: Number },
  altitude:       { type: Number },
  accuracy:       { type: Number },
  bearing:        { type: Number },
  speed:          { type: Number },
  level:          { type: Number },
  loc:            { type: [ Number ], index: "2d"},
  activityDate:   { type: Number, index: true }
})

// Beacons.path('bssid').required(true).validate(macAddressRE, "Name must be a valid mac address")

Beacons.pre('save', function(next) {
  delete this.loc
  if (this.longitude && this.latitude) {
    this.loc = [this.longitude, this.latitude]
  }
  if (this.bssid) {
    this.name = this.bssid
    this.namelc = this.bssid.toLowerCase()
  }
  next()
})

exports.getSchema = function() {
  return Beacons
}
