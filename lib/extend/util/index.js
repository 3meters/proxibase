/**
 * extend/util/index.js
 *
 *   Extend node's util
 */

var util = require('util')
var statics = require('./statics')
var loadConfig = require('./loadConfig')
var log = require('./log')
var timer = require('./timer')
var mail = require('./mail')
var misc = require('./misc')
var dbId = require('./dbId')
var request = require('./request')


// Proxibase extensions
var extensions = {
  config: loadConfig.load(),
  statics: statics,
  adminUser: statics.adminUser,
  log: log.log,
  logErr: log.logErr,
  Timer: timer.Timer,
  sendMail: mail.sendMail,
  getTime: misc.getTime,
  getTimeUTC: misc.getTime,
  truthy: misc.truthy,
  appStack: misc.appStack,
  typeOf: misc.typeOf,
  setConfig: misc.setConfig,
  clone: misc.clone,
  extend: misc.extend,
  genId: dbId.genId,
  parseId: dbId.parseId,
  request: request
}


// Extend node's util
for (var method in extensions) {
  util[method] = extensions[method]
}

// Export
module.exports = util

