/*
 * Devices schema
 *
 * _user: signed in user on the device
 * registrationId: provided by client and used to message GCM
 */

var mongo = require('../db')
var base = require('./_base')
var sDevice = util.statics.schemas.device

var beacon = {
  fields: {
    bssid: { type: 'string' },
  }
}

var device = {

  id: sDevice.id,
  name: sDevice.name,
  collection: sDevice.collection,

  fields: {
    _user:              { type: 'string', required: true, ref: 'users' },
    registrationId:     { type: 'string', required: true },
    clientVersionCode:  { type: 'number' },
    clientVersionName:  { type: 'string' },
    beacons:            { type: 'array', value: beacon.fields },
    beaconsDate:        { type: 'number' },
  },

  indexes: [
    {index: '_user'},
    {index: 'registrationId', options: { unique: true} }
  ]
}

exports.getSchema = function() {
  return mongo.createSchema(base, device)
}
