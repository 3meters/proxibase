/*
 * Db Util:  Shared Mongo database utilites
 *    Loaded and exposed via /util.js
 */

var assert = require('assert')
  , crypto = require('crypto')


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
exports.genId = function(schemaId, timeUTC) {

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
  return id
}


/*
 * Take an id string and attempt to parse it into it's meaningful parts
 * Only the tableId is validated.  If it is valid, the parsedId is returned,
 * otherwise null is returned.  The rest of the id is parsed without range
 * checking and is provided only as a convenience in the well-formed case.
 */
exports.parseId = function(idStr) {
  var id = {}, sep = '.', parts = []

  idStr = String(idStr) // make sure we're working with a string

  if (idStr.indexOf(sep) < 0) {
    // not a generated id, possibly one containing a mac address
    // see if the first part looks like a table Id
    var num = parseInt(idStr, 10)
    if (validTableId(num)) id.tableId = num
    else return proxErr.badSchemaId(idStr)
  }
  else {
    parts = idStr.split(sep)
    id.tableId = parseInt(parts[0])
    if (!validTableId(id.tableId)) return proxErr.badSchemaId(idStr)
    if (parts.length === 5) {
      // Assume the rest is well-formed.  If any code ever relies on this
      // being true we should validate the constituent parts
      id.yymmdd = parts[1]
      id.secondsSinceMidnight = parseInt(parts[2], 10)
      id.miliseconds = parseInt(parts[3], 10)
      id.recNum = parseInt(parts[4], 10)
    }
  }
  return id
}


var validTableId = exports.validTableId = function(num) {
  return (typeof num === 'number' && num >= 0 && num < 10000)
}


