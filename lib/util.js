var
  util = require('util')
  assert = require('assert')

/*
 * My logger.  log sends output to stdout async.  logErr sends to stderr synchronously,
 *   which alters the execution logic of the program, but will always give you output
 *   TODO: correctly handle string substution -- use console.log for that for now
 */

var log = module.exports.log = function(msg, obj, showHidden, level) {
  console.log(formatErr(msg, obj, showHidden, level))
}

var logErr = module.exports.logErr = function(msg, obj, showHidden, level) {
  console.error(formatErr(msg, obj, showHidden, level))
}

function formatErr(msg, obj, showHidden, level) {
  var out = ''
  if (typeof msg === 'string') {
    // if (msg.indexOf('%') >= 0) // asking for string substitution, hand off to console.log
    //   return console.log([].join.apply(arguments)) // aguments isn't a real array, steal a method
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
 * Send a nicely formatted error to a client that expects JSON
 * TODO:  This might be more elegently implemented by extending connect's res object with
 *        with a custom res.err(err) method
 */
module.exports.sendErr = function(res, err, statusCode) {
  statusCode = parseInt(statusCode) || 400
  var body = {}
  body.name = 'Error'
  body.error = 'Unexpected error message. Call for help.'
  if (typeof err === 'number') {
    statusCode = err
    if (err === 400) body.error = "Bad request"
    if (err === 404) body.error = "Not found"
    if (err === 500) body.error = "Unexpected server error"
  } else if (typeof err === 'string') {
    body.error = err
  } else if (err instanceof Error) {
    if (err.name) body.name = err.name
    if (err.message) body.error = err.message
    if (err.code) body.code = err.code
    if (err.errors) body.errors = err.errors
  }
  res.send(body, statusCode)
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
module.exports.genId = function(schemaId, timeUTC) {

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
  // log('now', now.getTime())
  // log('nowUTC', nowUTC.getTime())
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
  // log('_id', id)
  return id
}

// take an id string and attempt to parse it into it's meaningful parts
// since we do not enforce any format on the way in, this can fail
// in lots of unexpected ways.  Use with caution
module.exports.parseId = function(idStr) {
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


// returns milliseconds from 1/1/1970 preadjusted to UTC
var getTimeUTC = module.exports.getTimeUTC = function() {
  var now = new Date()
  var nowUTC = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
  return nowUTC.getTime()
}


// Experimental:  convert the monogodb driver's ObjectId to a more compact representation
function tiny(oid, alphabet) {
  var oid = oid || new mongoose.Types.ObjectId()
  var alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  var tinyId = ''
  var num = parseInt(oid, 16)  // broken: this looses precision, leading to collisions
  log(oid)
  log(num.toString(16))
  var radix = alphabet.length
  while (num > 0) {
    var remainder = num % radix
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix
  }
  return tinyId
}


