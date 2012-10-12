/**
 * util.js
 *
 * Proxibase utility module extends Node's built-in util
 */


var util = require('util')
  , dbUtil = require('./db/util')
  , async = require('async')


// Make long stack traces per http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
Error.stackTraceLimit = 1000

// Extend Array -- note that we use the serial, not parallel iterator
Array.prototype.forEachAsync = function(iterator, callback) {
  return require('async').forEachSeries(this, iterator, callback)
}


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

// Tests the truthyness of strings for boolean URL query parameters 
util.truthy = function(val) {
  if (typeof val !== 'string') return (val)
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}

// Repair javascript typeof to properly handle arrays and nulls
util.typeOf = function(v) {
  var s = typeof v
  if (s === 'object') {
   if (v) {
     if (v instanceof Array) s = 'array'
   }
   else s = 'null'
  }
  return s
}

// Creates a stack that filters out most non-app calls
util.appStack = function(fullStack) {
  var lines = []
  fullStack.split('\n').forEach(function(line) {
    if ((line.indexOf('node_modules') < 0)
      && (line.indexOf('events.js') < 0)
      && (line.indexOf('node.js') < 0)
      ) lines.push(line)
  })
  return lines.join('\n')
}

// Optionally override the default config
util.setConfig = function(file) {
  util.config = require('./util/loadconfig').load(file)
}

// Export extended util
module.exports = util

