/*
 * Beacons model
 */
var Schema = require('./_base').Schema;
var Beacons = new Schema(1);
var log = require('../log');


var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/;

Beacons.add = ({
  ssid:           { type: String, },
  label:          { type: String, },
  _beaconSetId:   { type: String, ref: 'beaconSets' },
  _registeredBy:  { type: String, ref: 'users' },
  locked:         { type: Boolean, default: false },
  visibility:     { type: String, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  lastLatitude:   { type: Number },
  lastLongitude:  { type: Number },
  lastElevation:  { type: Number },
  lastAccuracy:   { type: Number }

});

Beacons.path('name').required(true).validate(macAddressRE, "Name must be a valid mac address");

exports.getSchema = function() {
  return Beacons;
}
