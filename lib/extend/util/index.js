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
  handleDbErr: dbUtil.handleDbErr,
  getTime: misc.getTime,
  getTimeUTC: misc.getTime,
  truthy: misc.truthy,
  appStack: misc.appStack,
  typeOf: misc.typeOf,
  setConfig: misc.setConfig
}


// Extend and export
for (method in extensions) {
  util[method] = extensions[method]
}

util.adminUser = util.statics.adminUser

module.exports = util

