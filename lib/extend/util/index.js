/**
 * extend/util/index.js
 *
 *   Extend node's util
 */

var util = require('util')
  , dbUtil = require('../../db/util')
  , loadConfig = require('./loadConfig')
  , log = require('./log')
  , statics = require('./statics')
  , timer = require('./timer')
  , mail = require('./mail')
  , misc = require('./misc')
  , request = require('./request')


// Proxibase extensions
var extensions = {
  config: loadConfig.load(),
  statics: statics,
  log: log.log,
  logErr: log.logErr,
  Timer: timer.Timer,
  sendMail: mail.sendMail,
  genId: dbUtil.genId,
  parseId: dbUtil.parseId,
  validTableId: dbUtil.validTableId,
  getTime: misc.getTime,
  getTimeUTC: misc.getTime,
  truthy: misc.truthy,
  appStack: misc.appStack,
  typeOf: misc.typeOf,
  setConfig: misc.setConfig,
  clone: misc.clone,
  request: request
}


// Extend
for (method in extensions) {
  util[method] = extensions[method]
}
util.adminUser = util.statics.adminUser
util.extend = util._extend

// Export
module.exports = util

