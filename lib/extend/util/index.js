/**
 * extend/util/index.js
 *
 *   Extend node's util
 */

var util = require('util')
var statics = require('./statics')
var log = require('./log')
var misc = require('./misc')
var request = require('./request')

// Proxbase extensions that have no dependencies
var coreExtensions = {
  statics: statics,
  adminUser: statics.adminUser,
  getTime: misc.getTime,
  getTimeUTC: misc.getTime,
  type: misc.type,
  typeOf: misc.type,
  clone: misc.clone,
  send: misc.send,
  extend: misc.extend,
  truthy: misc.truthy,
  request: request,
  log: log.log,
  logErr: log.logErr,
}

// Extend node's util
for (var method in coreExtensions) {
  util[method] = coreExtensions[method]
}

// Export core
module.exports = util

// Load non-core modules, these may require core methods
var dbId = require('./dbId')
var timer = require('./timer')
var setConfig = require('./setConfig')
var mail = require('./mail')
var callService = require('./callService')
var checkParams = require('./checkParams')

// Extensions may rely on coreExtensions but not on each other
var extensions = {
  setConfig: setConfig,
  Timer: timer.Timer,
  sendMail: mail.sendMail,
  appStack: misc.appStack,
  genId: dbId.genId,
  parseId: dbId.parseId,
  callService: callService,
  checkParams: checkParams,
}

// Extend util some more
for (var method in extensions) {
  util[method] = extensions[method]
}

// Set the default util.config, can be overridden later
util.setConfig()
