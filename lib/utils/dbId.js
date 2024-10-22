/**
 * utils/dbId.js
 *
 *   generate and parse mongodb _ds
 */

var util = require('./')              // jshint ignore:line
var statics = require('../statics')   // jshint ignore:line

/*
 * genId: create a mongodb _id of type String that increase over time, have few collisions
 * under load, sort reasonably, and can be read by humans. They take the form: 
 *
 *    sc.yymmdd.scnds.mil.random
 *
 *  meaning:
 *
 *    schemaId.dateUTC.secondsSinceMidnightUTC.milliseconds.randomNumber
 */
exports.genId = function(schemaId, options) {

  if (!statics.schemaIds[schemaId]) {
    return new Error('Invalid schema Id')
  }
  options = options || {}
  var timestamp = options.timestamp || util.now()

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString()
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0'
    }
    return zeros + s
  }


  // UTC date, YYMMDD
  var nowUTC = new Date(timestamp)
  var year = pad((nowUTC.getFullYear() - 2000), 2)  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2) // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2)
  var dateUTC = year + month + day

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate())
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5) // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3)
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  var id = [schemaId, dateUTC, secondsUTC, millisecs, rand].join('.')
  return id
}


/*
 * Take an id string and attempt to parse it into it's meaningful parts
 * Only the schemaId is validated.  If it is valid, the parsedId is returned,
 * otherwise an error is returned.  The rest of the id is parsed without range
 * checking and is provided only as a convenience in the well-formed case.
 */
exports.parseId = function(idStr, onlyClName) {
  var id = {}, sep = '.', parts = []

  idStr = String(idStr) // make sure we're working with a string

  parts = idStr.split(sep)
  var schemaId = parts[0]
  var schema = statics.schemaIds[schemaId]

  if (!schema) {
    return new Error('Unrecognized Schema Id ' + schemaId)
  }

  // The most common case
  if (onlyClName) return schema.collection

  id.schemaId = schemaId
  id.schemaName = schema.name
  id.collectionName = schema.collection

  if (parts.length === 5) {
    // Assume the rest is well-formed.  If any code ever relies on this
    // being true we should validate the constituent parts
    id.yymmdd = parts[1]
    id.secondsSinceMidnight = parseInt(parts[2], 10)
    id.miliseconds = parseInt(parts[3], 10)
    id.recNum = parseInt(parts[4], 10)
  }
  return id
}

// Convience wrapper over parseId that just returns the collection name
exports.clNameFromId = function(idStr) {
  return exports.parseId(idStr, true)
}
