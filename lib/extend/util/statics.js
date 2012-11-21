/**
 * util/statics.js
 *
 *  Additional statics are computed by loadConfig.js and added to this object
 */

var statics = {
  adminUser: {
    _id: '0000.000000.00000.000.000000',
    name: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },
  collectionIdsNew: {
    users: 1,
    accounts: 2,
    sessions: 3,
    entities: 4,
    links: 5,
    actions: 6,
    observations: 7,
    documents: 8,
    beacons: 9
  },
  collectionIdMap: {},
  collectionIds: {
    users: 0,
    links: 1,
    entities: 2,
    beacons: 3,
    sessions: 4,
    documents: 5,
    observations: 7,
    places: 8,
    actions: 9
  },
  globalBeacon: {
    _id: '0003:00:00:00:00:00:00'
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
  langs: {
    en: true
  }
}

// Build a reverse map of collection names by Id
;(function() {
  for (var key in statics.collectionIds) {
    statics.collectionIdMap[statics.collectionIds[key]] = key
  }
})()

module.exports = statics
