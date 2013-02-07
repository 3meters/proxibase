/**
 * utils/index.js
 *    Proxibase utils module
 */

var util = require('util')
var log = require('./log')

for (var method in util) {
  exports[method] = util[method]
}
exports.type = require('./type')
exports.extend = require('./extend')
exports.clone = require('./clone')
exports.now = exports.getTime = exports.getTimeUTC = function(){return Date.now()}
exports.log = log.log
exports.logErr = log.logErr
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config, can be overridden later
exports.statics = require('./statics').statics
exports.adminUser = exports.statics.adminUser
exports.truthy = require('./truthy')
exports.appStack = require('./appStack')
exports.send = require('./send')
exports.Timer = require('./timer')
exports.callAll = require('./callAll')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.sendMail = require('./mail').sendMail
exports.callService = require('./callService')
exports.sources = require('./sources')
exports.check = require('./check')

// Run all sub-module init functions
exports.callAll(__dirname, 'init')
