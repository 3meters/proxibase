/*
 *  Observations model
 */

var
  Schema = require('../base').Schema,
  Observations = new Schema(7)

Observations.add({
  _beacon:    { type: String, required: true, ref: 'beacons', index: true },
  _entity:    { type: String, ref: 'entities', index: true },
  levelDb:    { type: Number },
  latitude:   { type: Number },
  longitude:  { type: Number },
  altitude:   { type: Number },
  accuracy:   { type: Number },
  bearing:    { type: Number },
  speed:      { type: Number },
  loc:        { type: [ Number ], index: "2d"}
})

Observations.pre('save', function(next) {
  delete this.loc
  if (this.longitude && this.latitude) {
    this.loc = [this.longitude, this.latitude]
  }
  next()
})

exports.getSchema = function() {
  return Observations
}