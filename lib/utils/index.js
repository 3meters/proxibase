/**
 * proxutils/index.js
 *    Proxibase utils module
 */

exports._ = require('lodash')  // replaces underscore

var statics = require('../statics')   // jshint ignore:line
statics.init()

var nodeUtil = require('util')
for (var method in nodeUtil) {
  exports[method] = nodeUtil[method]
}

// Order matters: utils can only require previously declared utils
exports.clone = require('./clone')
exports.tipe = require('tipe')
exports.noop = function() {}
exports.now = function() { return Date.now() }
exports.nowFormatted = function() {return new Date().toUTCString() }
exports.nowUTC = exports.nowFormatted
exports.seed = function(len) {
  len = len || 6
  return String(Math.floor(Math.random() * Math.pow(10, len)))
}
exports.extend = exports._.extend
exports.haversine = require('./haversine')
exports.denoise = require('./denoise')
exports.appStack = require('./appStack')
exports.log = require('./log').log
exports.logErr = require('./log').logErr
exports.logError = require('./log').logErr
exports.debug = require('./log').debug
exports.callAll = require('./callAll')
exports.setConfig = require('./setConfig')
exports.setConfig() // Sets util.config can be overridden later
exports.statics = require('../statics')
exports.adminUser = exports.statics.adminUser
exports.adminId = exports.statics.adminId
exports.anonUser = exports.statics.anonUser
exports.anonId = exports.statics.anonId
exports.perr = require('./error')
exports.proxErr = exports.perr
exports.timer = require('./timer')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.nextDoc = require('./nextDoc')
exports.sendMail = require('./sendMail')
exports.scrub = require('./scrub')
exports.timeLimit = require('./timeLimit')
exports.request = require('./request')
exports.callService = require('./callService')
exports.calcStats = require('./calcStats')
exports.ensureUsers = require('./ensureUsers')
exports.tasks = {}
exports.db = {}


// TODO: Clean up depricated method aliases
exports.getTime = exports.now
exports.getTimeUTC = exports.now

// Run all sub-module init functions
exports.callAll(__dirname, 'init')
