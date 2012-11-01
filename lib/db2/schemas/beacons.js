/*
 * Beacons schema
 */

var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/

var schema = {
  id: 3,
  fields: {
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
    loc:            { type: [ Number ]},
    activityDate:   { type: Number, index: true }
  },
  indexes: {
    loc: "2d"
  }
}


/*
TODO: put back
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
*/

exports.schema = schema
