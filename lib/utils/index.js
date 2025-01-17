/**
 * proxutils/index.js
 *    Proxibase utils module
 */

exports._ = require('lodash')

var statics = require('../statics')   // jshint ignore:line
statics.init()

var nodeUtil = require('util')
for (var method in nodeUtil) {
  exports[method] = nodeUtil[method]
}

// load our localizable string files
exports.getStr = require('./getStr')
exports.getStr.init(require('../strings'))

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
exports.statics = require('../statics')
exports.adminUser = exports.statics.adminUser
exports.adminId = exports.statics.adminId
exports.anonUser = exports.statics.anonUser
exports.anonId = exports.statics.anonId

exports.perr = require('./error')
exports.perr.init(require('../errors'))
exports.proxErr = exports.perr
// Tell tipe that ProxErr is an Error
exports.tipe.add('ProxErr', 'error')

exports.timer = require('./timer')
exports.lock = require('./lock')
exports.genId = require('./dbId').genId
exports.parseId = require('./dbId').parseId
exports.clNameFromId = require('./dbId').clNameFromId
exports.sendMail = require('./sendMail')
exports.scrub = require('./scrub')
exports.timeLimit = require('./timeLimit')
exports.request = require('./request')
exports.callService = require('./callService')
exports.latLngToLocation = require('./latLngToLocation')
exports.db = {}
exports.adminOps = function(ops) {
  return exports._.assign({asAdmin: true}, exports._.pick(ops, ['tag', 'test', 'noTickle']))
}

// TODO: Clean up depricated method aliases
exports.getTime = exports.now
exports.getTimeUTC = exports.now
