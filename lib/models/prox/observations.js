/*
 *  Observations model
 */

var
  Schema = require('../base').Schema,
  Observations = new Schema(7)

Observations.add({
  _beacon:    { type: String, ref: 'beacons', index: true },
  _entity:    { type: String, ref: 'entities', index: true },
  ssid:       { type: String, required: true, index: true },
  bssid:      { type: String},
  latitude:   { type: Number },
  longitude:  { type: Number },
  altitude:   { type: Number },
  accuracy:   { type: Number },
  bearing:    { type: Number },
  speed:      { type: Number },
  loc:        { type: [ Number ], index: "2d"}
})

Observations.pre('save', function(next) {
  this.loc = [this.latitude, this.longitude]
  next()
})


exports.getSchema = function() {
  return Observations
}

