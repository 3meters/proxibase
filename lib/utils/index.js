/**
 * utils/index.js
 *
 *   Extend node's util
 */


var util = require('util')
var core = require('./core')


// Extensions that have no dependencies
var coreExtensions = {
  type: core.type,
  typeOf: core.type,   // deprecate
  extend: core.extend,
  clone: core.clone,
  getTime: core.getTime,
  getTimeUTC: core.getTime,
  log: require('./log').log,
  logErr: require('./log').logErr,
  request: require('./request'),
}

// Extend node's util
for (var method in coreExtensions) {
  util[method] = coreExtensions[method]
}

global.log = util.log

// Export core
module.exports = util

// Load non-core modules, these may require core methods but not each other
var extensions = {
  statics: require('./statics'),
  adminUser: require('./statics').adminUser,
  truthy: require('./truthy'),
  send: require('./send'),
  setConfig: require('./setConfig'),
  Timer: require('./timer').Timer,
  sendMail: require('./mail').sendMail,
  appStack: require('./appStack'),
  genId: require('./dbId').genId,
  parseId: require('./dbId').parseId,
  callService: require('./callService'),
  checkParams: require('./checkParams'),
}

// Extend util some more
for (var method in extensions) {
  util[method] = extensions[method]
}

// Set the default util.config, can be overridden later
util.setConfig()

return util
