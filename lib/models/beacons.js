/*
 * Beacons model
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema
var ObjectId = Schema.ObjectId;

function exists(v) {
  return v && v.length;
}

function validateMacAddress(v) {
  var macAddressRE = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/;
  return v && v.length && macAddressRE.test(v);
}

var Beacon = new Schema({
  id:             { type: String, validate: [validateMacAddress, 'valid mac address is required'] },
  owner:          { type: ObjectId, validate: [exists, 'owner is required'] },
  ssid:           { type: String, },
  label:          { type: String, },
  beaconSetId:    { type: ObjectId },
  registeredBy:   { type: ObjectId },
  locked:         { type: Boolean, default: false },
  visibility:     { type: String, default: 'public' },
  beaconType:     { type: String, default: 'fixed' },
  lastLatitude:   { type: Number },
  lastLongitude:  { type: Number },
  lastElevation:  { type: Number },
  created:        { type: Date, default: Date.now() },
  createdBy:      { type: ObjectId },
  lastModified:   { type: Date, default: Date.now() },
  lastModifiedBy: { type: ObjectId },
  lastRead:       { type: Date, default: Date.now() },
  lastReadBy:     { type: ObjectId }

});

/*
Beacon.virtual('id')
  .get(function() {
    return this._id;
  });
*/

Beacon.method('serialize', function() {
  var response = {};
  response.id = this.id;
  response.owner = '/api/user/'+ this.owner;
  response.ssid = this.ssid;
  response.label = this.label;
  return response;
});

module.exports.Model = function(mdb) {
  return mdb.model('Beacon', Beacon);
}
