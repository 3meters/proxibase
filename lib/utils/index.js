/**
 * utils/index.js
 *    Proxibase utils module
 */

var util = require('util')
var core = require('./core')
var log = require('./log')

for (var method in util) {
  exports[method] = util[method]
}
exports.type = core.type
exports.extend = core.extend
exports.clone = core.clone
exports.now = exports.getTime = exports.getTimeUTC = core.getTime
exports.log = log.log
exports.logErr = log.logErr
global.log = exports.log
global.logErr = exports.logErr
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config, can be overridden later
exports.statics = require('./statics').statics
exports.adminUser = exports.statics.adminUser
exports.truthy = require('./truthy')
exports.appStack = require('./appStack')
exports.send = require('./send')
exports.Timer = require('./timer').Timer
exports.callAll = require('./callAll')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.sendMail = require('./mail').sendMail
exports.request = require('./request')
exports.callService = require('./callService')
exports.sources = require('./sources')
exports.check = require('./check')

// Run all sub-module init functions
exports.callAll(__dirname, 'init')
