/*
 * Proxibase utility module -- extends Node's built-in util
 */


var
  util = require('util'),
  assert = require('assert'),
  fs = require('fs'),
  crypto = require('crypto')


// Statics
util.statics = {
  adminId: '0000.000000.00000.000.000000',
  internalLimit: 10000,
  optionsLimitDefault: 50,
  optionsLimitMax: 1000,
  activityDateWindow: 5000,
  session: {
    timeToLive: 1000*60*60*24*14,  // Two weeks in miliseconds
    refreshAfter: 1000*60*60*24*7,  // One week in miliseconds
  },
  authSources: {
    local: true,
    facebook: true,
    twitter: true,
    google: true
  },
  langs: {
    en: true
  }
}


/*
 * Our logger: log sends output to stdout async.  logErr sends to stderr synchronously,
 *   which can alter the execution logic of the program, but will always provide output
 */
util.log = function(msg, obj, showHidden, level) {
  console.log(formatErr(msg, obj, showHidden, level))
}

util.logErr = function(msg, obj, showHidden, level) {
  console.error(formatErr(msg, obj, showHidden, level))
}

function formatErr(msg, obj, showHidden, level) {
  var out = ''
  if (!msg) return out
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
      showHidden = showHidden || false
      level = level || 3
      out = msg + "\n" + util.inspect(obj, showHidden, level)
    }
  } else {
    // no message, just an object, shift params left
    level = showHidden || 3
    showHidden = obj || false
    obj = msg
    out = util.inspect(obj, showHidden, level)
  }
  return out
}


/*
 * Find config file, first searching for the full path
 *   then for a file in the $PROX/conf directory
 */
util.findConfig = function(configFile) {
  configFile = configFile || 'config.js'
  var config
  try {
    config = require(configFile)
  }
  catch(e) {
    // then search for the config file in $PROX/conf
    try {
      config = require(__dirname + '/../config/' + configFile)
    }
    catch(e) {
      util.log('Fatal: could not load config file ' + configFile)
      util.log('Error: ' + e.message || e.stack)
      process.exit(1)
    }
  }

  // compute the server secret identifying internal secure API calls
  var serverKey = fs.readFileSync(config.service.ssl.keyFilePath, 'utf8')
  util.statics.serverSecret = crypto.createHmac('sha1', 'adaBarks' + serverKey).digest('hex')

  return config
}


/*
 * Return the service URL from a given config
 */
util.getRootUrl = function(config) {
  var port = (config.service.port === 443 || config.service.port === 443) ? '' : ':' + config.service.port
  return config.service.protocol + '://' + config.service.host + port
}


/*
 * Timer
 */
util.Timer = function() {

  var
    startTime = null
    offset = new Date(2010, 0, 1).getTime()  // 40 years from Javascript Date begin

  // Make sure caller uses new
  if (!(this instanceof arguments.callee)) {
    throw new Error('util.Timer must be called as a constructor:  e.g. mytimer = new util.Timer()')
  }

  // Offset -- seconds between 1/1/1970 and 1/1/2010
  this.offset = function () {
    return offset/1000
  }

  // Start
  this.start = function() {
    startTime = new Date().getTime() - offset
  }

  // Base: return the number of seconds between 1/1/2010 and the start time
  this.base = function() {
    return startTime/1000
  }

  // Read and keep timing
  var read = this.read = function() {
    return (new Date().getTime() - offset - startTime) / 1000
  }

  this.start()  // newing a timer starts it implicitly
}


/*
 * genId: create a mongodb _id of type String that increase over time, have few collisions
 * under load, sort reasonably, and can be read by humans. They take the form: 
 *
 *    sche.yymmdd.scnds.mil.random
 *
 *  meaning:
 *
 *    schemaId.dateUTC.secondsSinceMidnightUTC.milliseconds.randomNumber
 *
 */
util.genId = function(schemaId, timeUTC) {

  assert(parseInt(schemaId) >= 0, "Invalid schemaId")
  timeUTC = timeUTC || getTimeUTC()

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString()
    assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s)
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0'
    }
    return zeros + s
  }

  // schemaId, integer 0-9999
  var schema = pad(schemaId, 4)

  // UTC date, YYMMDD
  var nowUTC = new Date(timeUTC)
  var year = pad((nowUTC.getFullYear() - 2000), 2)  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2) // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2)
  var dateUTC = year + month + day 

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate())
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5) // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3)
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  var id = [schema, dateUTC, secondsUTC, millisecs, rand].join('.')
  // util.log('_id', id)
  return id
}


/*
 * Take an id string and attempt to parse it into it's meaningful parts
 * since we do not enforce any format on the way in, this can fail
 * in lots of unexpected ways.  Use with caution
 */
util.parseId = function(idStr) {
  var id = {}, sep = '.', parts = []

  if (idStr.indexOf(sep) < 0) {
    // not a generated id, possibly one containing a mac address
    // see if the first part looks like a table Id
    var num = parseInt(idStr, 10)
    if (num >= 0 && num <= 9999) id.tableId = num
    return id
  }
  parts = idStr.split(sep)
  if (parts.length != 5) return id
  // assume it a validly formated proxibase id
  // this will need to be hardend in the real world
  id.tableId = parseInt(parts[0])
  id.yymmdd = parts[1]
  id.secondsSinceMidnight = parts[2]
  id.miliseconds = parts[3]
  id.recNum = parts[4]
  return id
}


/*
 * Returns milliseconds from 1/1/1970 unadjusted for timezone.
 * Currently isn't doing anything special but here as a future
 * choke point if needed.
 */
var getTimeUTC = util.getTimeUTC = function() {
  var now = new Date()
  return now.getTime()
}


// Experimental:  convert the monogodb driver's ObjectId to a more compact representation
function tiny(oid, alphabet) {
  var oid = oid || new mongoose.Types.ObjectId()
  var alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  var tinyId = ''
  var num = parseInt(oid, 16)  // broken: this looses precision, leading to collisions
  util.log(oid)
  util.log(num.toString(16))
  var radix = alphabet.length
  while (num > 0) {
    var remainder = num % radix
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix
  }
  return tinyId
}


// Export extended util
module.exports = util

