/*
 * Installs schema
 *
 * _user: signed in user for the install
 * registrationId: provided by client and used to message GCM
 * installId: unique identifier for an aircandi install
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var location = require('./_location')
var sInstall = statics.schemas.install

var beacon = {
  fields: {
    bssid: { type: 'string' },
  }
}

var install = {

  id: sInstall.id,
  name: sInstall.name,
  collection: sInstall.collection,
  system: true,

  fields: {
    _user:              { type: 'string', required: true, ref: 'users' },
    users:              { type: 'array' },
    signinDate:         { type: 'number' },
    registrationId:     { type: 'string' },
    installId:          { type: 'string', required: true },
    deviceName:         { type: 'string' },
    clientVersionCode:  { type: 'number' },
    clientVersionName:  { type: 'string' },
    clientPackageName:  { type: 'string' },
    beacons:            { type: 'array', value: beacon.fields },
    beaconsDate:        { type: 'number' },
    locationDate:       { type: 'number' },
  },

  indexes: [
    {index: '_user'},
    {index: 'installId', options: { unique: true} }
  ],

  methods: {
    genId: genId
  }
}


// Override the _base genId function with one that uses
// the installId
function genId(doc) {
  if (!doc.installId) return perr.missingParam('installId')
  return this.schema.id + '.' + doc.installId
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, install)
}
