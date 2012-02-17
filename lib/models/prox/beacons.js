/*
/*
 * Beacons model
 */
var Schema = require('../base').Schema;
var Beacons = new Schema(1);
var log = require('../../log');


var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/;

Beacons.add = ({
  ssid:           { type: String, },
  label:          { type: String, },
  _beaconSet:     { type: String, ref: 'beaconsets' },
  locked:         { type: Boolean, default: false },
  visibility:     { type: String, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  latitude:       { type: Number },
  longitude:      { type: Number },
  altitude:       { type: Number },
  accuracy:       { type: Number },
  bearing:        { type: Number },
  speed:          { type: Number }
});

Beacons.path('name').required(true).validate(macAddressRE, "Name must be a valid mac address");

exports.getSchema = function() {
  return Beacons;
}
