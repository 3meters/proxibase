/*
 * Installs schema
 *
 * _user: signed in user for the install
 * registrationId: provided by client and used to message GCM
 * installId: unique identifier for an aircandi install
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
  system: false, // BUG: should be true

  fields: {
    _user:              { type: 'string', required: true, ref: 'users' },
    users:              { type: 'array' },
    signinDate:         { type: 'number' },
    registrationId:     { type: 'string', required: true },
    installId:          { type: 'string', required: true },
    clientVersionCode:  { type: 'number' },
    clientVersionName:  { type: 'string' },
    clientPackageName:  { type: 'string' },
    beacons:            { type: 'array', value: beacon.fields },
    beaconsDate:        { type: 'number' },
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
  return mongo.createSchema(base, install)
}
