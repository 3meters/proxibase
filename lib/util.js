/**
 * util.js
 *
 * Proxibase utility module extends Node's built-in util
 */


var util = require('util')
  , dbUtil = require('./db/util')


// Load the default config
util.config = require('./util/loadconfig').load()
util.statics = require('./util/statics')
util.adminUser = util.statics.adminUser
util.log = require('./util/log').log
util.logErr = require('./util/log').logErr
util.Timer = require('./util/timer').Timer
util.sendMail = require('./util/mail').sendMail
util.genId = dbUtil.genId
util.parseId = dbUtil.parseId
util.validTableId = dbUtil.validTableId
util.handleDbErr = dbUtil.handleDbErr

// Synonym for Date.now()
util.getTimeUTC = util.getTime = function() {
  var now = new Date()
  return now.getTime()
}

// Optionally override the default config
util.setConfig = function(file) {
  util.config = require('./util/loadconfig').load(file)
}

// Export extended util
module.exports = util

