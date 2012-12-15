/**
 * util/statics.js
 *
 *  Additional statics are computed by loadConfig.js and added to this object
 */

var statics = {
  adminUser: {
    _id: '0001.000000.00000.000.000000',
    name: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },
  collectionIds: {
    users: '0001',
    accounts: '0002',
    sessions: '0003',
    entities: '0004',
    links: '0005',
    actions: '0006',
    documents: '0007',
    beacons: '0008'
  },
  collectionIdMap: {},
  globalBeacon: {
    _id: '0008.00:00:00:00:00:00'
  },
  clientVersion: {
    _id: '0007.000000.00000.000.000000',
    data: {
      updateUri: 'https://aircandi.com/install',
      version: '0.0.0'  // don't change this value, update it in the database
    }
  },
  internalLimit: 10000,
  optionsLimitDefault: 50,
  optionsLimitMax: 1000,
  activityDateWindow: 5000,
  session: {
    timeToLive: 1000*60*60*24*14,  // Two weeks in miliseconds
    refreshAfter: 1000*60*60*24*7,  // One week in miliseconds
  },
  authSources: {
    local: true,
    facebook: true,
    twitter: true,
    google: true
  },
  services: {
    foursquare: {
      root: 'https://api.foursquare.com/v2/venues/',
      cred: 'client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
    },
    google: {
      root: 'https://',
      cred: '',
    },
    factual: {
      root: 'https://',
      cred: '', 
    }
  },
  langs: {
    en: true
  },
}

// Build a reverse map of collection names by Id
;(function() {
  for (var key in statics.collectionIds) {
    statics.collectionIdMap[statics.collectionIds[key]] = key
  }
})()

module.exports = statics
