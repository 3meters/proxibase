/*
 * Installs schema
 *
 * _user: signed in user for the install
 * parseInstallId: provided by client and used to message Parse
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
    installId:          { type: 'string', required: true },
    parseInstallId:     { type: 'string' },  // Will be deprecated once we have fully switched over to OneSignal
    pushInstallId:      { type: 'string' },  // OneSignal calls this the player id. I believe players==users
    subscribed:         { type: 'boolean', default: true },
    clientVersionCode:  { type: 'number' },
    clientVersionName:  { type: 'string' },
    clientPackageName:  { type: 'string' },
    deviceName:         { type: 'string' },
    deviceType:         { type: 'string' },   // e.g. android, ios
    deviceVersionName:  { type: 'string' },
    beacons:            { type: 'array', value: beacon.fields },
    beaconsDate:        { type: 'number' },
    locationDate:       { type: 'number' },
    _user:              { type: 'string', ref: 'users' },   // Last logged in user
    signinDate:         { type: 'number' },
  },

  indexes: [
    {index: '_user'},
    {index: 'parseInstallId'},
    {index: 'pushInstallId'},
    {index: 'beaconsDate'},
    {index: 'installId', options: { unique: true} },
  ],

  methods: {
    genId: genId
  }
}


// Override the _base genId function with one that uses
// the installId.  If installId is already well-formed
// return it unmodified.
function genId(doc) {
  if (!doc.installId) return util.statics.anonInstallId
  var prefix = this.schema.id + '.'
  if (doc.installId.indexOf(prefix) === 0) return doc.installId
  return prefix + doc.installId
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, install)
}
