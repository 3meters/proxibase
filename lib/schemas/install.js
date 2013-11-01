/*
 * Installs schema
 *
 * _user: signed in user for the install
 * registrationId: provided by client and used to message GCM
 * installationId: unique identifier for an aircandi install
 */

var mongo = require('../db')
var base = require('./_base')
var sInstall = util.statics.schemas.install

var beacon = {
  fields: {
    bssid: { type: 'string' },
  }
}

var install = {

  id: sInstall.id,
  name: sInstall.name,
  collection: sInstall.collection,

  fields: {
    _user:              { type: 'string', required: true, ref: 'users' },
    registrationId:     { type: 'string', required: true },
    installationId:     { type: 'string', required: true },
    clientVersionCode:  { type: 'number' },
    clientVersionName:  { type: 'string' },
    beacons:            { type: 'array', value: beacon.fields },
    beaconsDate:        { type: 'number' },
  },

  indexes: [
    {index: '_user'},
    {index: 'installationId', options: { unique: true} }
  ]
}

exports.getSchema = function() {
  return mongo.createSchema(base, install)
}