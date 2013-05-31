/*
 * Devices schema
 *
 * _user: signed in user on the device
 * registrationId: provided by client and used to message GCM
 */

var mongo = require('../db')
var base = require('./_base')
var devices = {}
var beacon = {}

beacon.fields = {
  bssid:          { type: 'string' },
}

devices.id = util.statics.collectionIds.devices

devices.fields = {
  _user:              { type: 'string', required: true, ref: 'users' },
  registrationId:     { type: 'string', required: true },
  clientVersionCode:  { type: 'number' },
  clientVersionName:  { type: 'string' },
  beacons:            { type: 'array', value: beacon.fields },
  beaconsDate:        { type: 'number' },
}

devices.indexes = [
  {index: '_user'},
  {index: 'registrationId', options: { unique: true} }
]

exports.getSchema = function() {
  return mongo.createSchema(base, devices)
}
