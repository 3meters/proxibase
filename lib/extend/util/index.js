/**
 * extend/util/index.js
 *
 *   Extend node's util
 */

var util = require('util')
var statics = require('./statics')
var setConfig = require('./setConfig')
var log = require('./log')
var timer = require('./timer')
var mail = require('./mail')
var misc = require('./misc')
var dbId = require('./dbId')
var request = require('./request')

// Proxbase extensions that have no dependencies
var coreExtensions = {
  statics: statics,
  adminUser: statics.adminUser,
  getTime: misc.getTime,
  getTimeUTC: misc.getTime,
  typeOf: misc.typeOf,
  clone: misc.clone,
  send: misc.send,
  extend: misc.extend,
  truthy: misc.truthy,
}

// Proxibase extensions that may rely on coreExtensions
// but not on each other
var extensions = {
  setConfig: setConfig,
  log: log.log,
  logErr: log.logErr,
  Timer: timer.Timer,
  sendMail: mail.sendMail,
  appStack: misc.appStack,
  genId: dbId.genId,
  parseId: dbId.parseId,
  request: request
}

// Extend node's util
for (var method in coreExtensions) {
  util[method] = coreExtensions[method]
}

// Export
module.exports = util

// Extend some more
for (var method in extensions) {
  util[method] = extensions[method]
}

// Set the default util.config, can be overridden later
util.setConfig()
