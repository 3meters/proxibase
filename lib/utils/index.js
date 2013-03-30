/**
 * proxutils/index.js
 *    Proxibase utils module
 */

exports._ = require('underscore')

var nodeUtil = require('util')
for (var method in nodeUtil) {
  exports[method] = nodeUtil[method]
}

// Order matters: utils can require previously declared utils
exports.clone = require('./clone')
exports.type = require('./type')
exports.now = function() { return Date.now() }
exports.noop = function() {}
exports.log = require('./log').log
exports.logErr = require('./log').logErr
exports.match = require('./match')
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config, can be overridden later
exports.statics = require('./statics').statics
exports.statics.sources = require('./sources').sources
exports.adminUser = exports.statics.adminUser
exports.appStack = require('./appStack')
exports.perr = require('./error')
exports.proxErr = exports.perr
exports.send = require('./send')
exports.Timer = require('./timer')
exports.callAll = require('./callAll')
exports.truthy = require('./truthy')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.sendMail = require('./mail').sendMail
exports.check = require('./check')
exports.request = require('./request')
exports.callService = require('./callService')

// TODO: Clean up depricated method aliases
exports.getTime = exports.now
exports.getTimeUTC = exports.now

// Run all sub-module init functions
exports.callAll(__dirname, 'init')

