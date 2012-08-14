/*
 * Proxibase utility module -- extends Node's built-in util
 */


var util = require('util'),
  dbUtil = require('./db/util')



util.statics = require('./util/statics')
util.adminUser = util.statics.adminUser
util.log = require('./util/log').log
util.logErr = require('./util/log').logErr
util.loadConfig = require('./util/config').load
util.sendMail = require('./util/mail').sendMail
util.Timer = require('./util/timer').Timer
util.genId = dbUtil.genId
util.parseId = dbUtil.parseId
util.validTableId = dbUtil.validTableId
util.handleDbErr = dbUtil.handleDbErr



/*
 * Returns milliseconds from 1/1/1970 unadjusted for timezone.
 * Currently isn't doing anything special but here as a future
 * choke point if needed.
 */
util.getTimeUTC = function() {
  var now = new Date()
  return now.getTime()
}


// Export extended util
module.exports = util

