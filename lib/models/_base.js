
/*
 * Base Schema inherited by all Models
 */

var util = require('util');
var assert = require('assert');
var mongoose = require('mongoose');
var inspect = require('../utils').inspect;


var Schema = exports.Schema = function(schemaId) {

  registerSchemaId(schemaId);

  function genId() {
    return _genId(schemaId);
  }

  mongoose.Schema.call(this);
  this.add({
    name:       { type: String },
    _id:        { type: String, default: genId},
    _owner:     { type: String, ref: 'users' },
    _createdBy: { type: String, ref: 'users' },
    _changedBy: { type: String, ref: 'users' },
    changed:    { type: Number, set: getDateUTC.now }
  });

  this.statics = {
    serialize: serialize,
    genId: genId,
    getRefs: getRefs,
    getDateUTC: getDateUTC
  }

}

util.inherits(Schema, mongoose.Schema);

// Static class map of registered schemaIds
Schema.schemaIds = Schema.schemaIds || {};

// Validate and register the constructors schemaId
function registerSchemaId(schemaId) {
  assert(schemaId >= 0 && schemaId < 1000, "Invalid schemaId: " + schemaId);
  assert(!Schema.schemaIds[schemaId], "Duplicate schemaId: " + schemaId);
  Schema.schemaIds[schemaId] = schemaId;
}

/*
 * _genId: create a mongodb _id of type String that increase over time, have few collisions
 * under load, sort reasonably, and can be read by humans. They take the form: 
 *
 *    sche.yymmdd.scnds.mil.random
 *
 *  meaning:
 *
 *    schemaId.dateUTC.secondsSinceMidnightUTC.milliseconds.randomNumber
 *
 */
function _genId(schemaId) {

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString();
    if (s.indexOf('-') >= 0 || s.indexOf('.') >= 0 || s.length > digits)
      throw new Error('Invalid id seed: ' + s);
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0';
    }
    return zeros + s;
  }

  // schemaId, integer 0-9999
  var schema = pad(schemaId, 4);

  // UTC date, YYMMDD
  var nowUTC = getDateUTC();
  // inspect('now', now.getTime());
  // inspect('nowUTC', nowUTC.getTime());
  var year = pad((nowUTC.getFullYear() - 2000), 2);  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2); // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2);
  var dateUTC = year + month + day; 

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate());
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5); // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  return [schema, dateUTC, secondsUTC, millisecs, rand].join('.');
}

// like Date but UTC
var getDateUTC = function() {
  var now = new Date();
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
}

// run any custom getters
function serialize(doc) {
  doc = doc.toObject({ getters: true });
  delete doc.id;
  return doc;
}

// populate an array of reference columns, aka foreign keys
function getRefs() {
  var refs = [];
  var tree = this.schema.tree; // this may be is a private object
  for (path in tree) {
    if (tree[path].ref) refs.push(path); 
  }
  return refs;
}

// Experimental:  convert the monogodb driver's ObjectId to a more compact representation
function tiny(oid, alphabet) {
  var oid = oid || new mongoose.Types.ObjectId();
  var alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var tinyId = '';
  var num = parseInt(oid, 16);  // broken: this looses precision, leading to collisions
  console.log(oid);
  console.log(num.toString(16));
  var radix = alphabet.length;
  while (num > 0) {
    var remainder = num % radix;
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix;
  }
  return tinyId;
}


