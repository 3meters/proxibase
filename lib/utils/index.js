/**
 * proxutils/index.js
 *    Proxibase utils module
 */

exports._ = require('underscore')

var statics = require('../statics')   // jshint ignore:line
statics.init()

var nodeUtil = require('util')
for (var method in nodeUtil) {
  exports[method] = nodeUtil[method]
}

// Order matters: utils can only require previously declared utils
exports.clone = require('./clone')
exports.tipe = require('tipe')
exports.now = function() { return Date.now() }
exports.nowFormatted = function() {return new Date().toUTCString() }
exports.noop = function() {}
exports.haversine = require('./haversine')
exports.denoise = require('./denoise')
exports.appStack = require('./appStack')
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config, can be overridden later
exports.statics = require('../statics')
exports.adminUser = exports.statics.adminUser
exports.adminId = exports.statics.adminId
exports.anonUser = exports.statics.anonUser
exports.anonId = exports.statics.anonId
exports.log = require('./log').log
exports.logErr = require('./log').logErr
exports.debug = require('./log').debug
exports.perr = require('./error')
exports.proxErr = exports.perr
exports.send = require('./send')
exports.timer = require('./timer')
exports.callAll = require('./callAll')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.nextDoc = require('./nextDoc')
exports.sendMail = require('./mail').sendMail
exports.scrub = require('./scrub')
exports.timeLimit = require('./timeLimit')
exports.request = require('./request')
exports.callService = require('./callService')
exports.tasks = {}
exports.db = {}


// TODO: Clean up depricated method aliases
exports.getTime = exports.now
exports.getTimeUTC = exports.now

// Run all sub-module init functions
exports.callAll(__dirname, 'init')
