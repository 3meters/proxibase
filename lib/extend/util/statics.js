/**
 * util/statics.js
 *
 *  Additional statics are computed by loadConfig.js and added to this object
 */

module.exports = {
  adminUser: {
    _id: '0000.000000.00000.000.000000',
    name: 'admin',
    email: 'admin',
    role: 'admin'
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

