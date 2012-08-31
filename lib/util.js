/*
 * Proxibase utility module -- extends Node's built-in util
 */


var util = require('util'),
  dbUtil = require('./db/util')


// Load the config file
util.loadConfig = function(configFile) {
  util.config = require('./util/loadconfig').load(configFile)
}


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



/*
 * Returns milliseconds from 1/1/1970 unadjusted for timezone.
 * Currently isn't doing anything special but here as a future
 * choke point if needed.
 */
util.getTime = util.getTimeUTC = function() {
  var now = new Date()
  return now.getTime()
}


// Export extended util
module.exports = util

