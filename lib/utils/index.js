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
exports.nowFormatted = function() {return new Date().toUTCString() }
exports.noop = function() {}
exports.haversine = require('./haversine')
exports.appStack = require('./appStack')
exports.match = require('./match')
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config, can be overridden later
exports.statics = require('./statics').statics
exports.statics.applinks = require('./applinks').applinks
exports.adminUser = exports.statics.adminUser
exports.log = require('./log').log
exports.logErr = require('./log').logErr
exports.perr = require('./error')
exports.proxErr = exports.perr
exports.send = require('./send')
exports.Timer = require('./timer')
exports.callAll = require('./callAll')
exports.truthy = require('./truthy')
exports.genId = require('../db/dbId').genId
exports.parseId = require('../db/dbId').parseId
exports.sendMail = require('./mail').sendMail
exports.check = require('./check')
exports.request = require('./request')
exports.callService = require('./callService')

// TODO: Clean up depricated method aliases
exports.getTime = exports.now
exports.getTimeUTC = exports.now

// Run all sub-module init functions
exports.callAll(__dirname, 'init')

