
/*
 * Base Schema inherited by all Models
 */

var util = require('util');
var assert = require('assert');
var mongoose = require('mongoose');
var log = require('../log');


var Schema = exports.Schema = function(schemaId) {

  registerSchemaId(schemaId);

  mongoose.Schema.call(this);

  this.add({
    name:         { type: String, index: true },
    _id:          { type: String },
    _owner:       { type: String, index: true, ref: 'users' },
    _creator:     { type: String, ref: 'users' },
    _modifier:    { type: String, ref: 'users' },
    createdDate:  { type: Number },
    modifiedDate: { type: Number, index: true}
  });

  this.pre('save', function(next) {
    if (!this.modifiedDate)
      this.modifiedDate = getTimeUTC();
    if (this.isNew) {
      if (!this.createdDate)
        this.createdDate = this.modifiedDate;
      if (!this._id)
        this._id = genId(schemaId, this.createdDate);
    }
    next();
  });

  this.statics = {
    serialize: serialize
  }
}

util.inherits(Schema, mongoose.Schema);

// Static class map of registered schemaIds
Schema.schemaIds = Schema.schemaIds || {};

// Validate and register the constructor's schemaId
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
function genId(schemaId, timeUTC) {

  assert(parseInt(schemaId) >= 0 && timeUTC, "Invalid call to genId");

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString();
    assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s);
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0';
    }
    return zeros + s;
  }

  // schemaId, integer 0-9999
  var schema = pad(schemaId, 4);

  // UTC date, YYMMDD
  var nowUTC = new Date(timeUTC);
  // log('now', now.getTime());
  // log('nowUTC', nowUTC.getTime());
  var year = pad((nowUTC.getFullYear() - 2000), 2);  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2); // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2);
  var dateUTC = year + month + day; 

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate());
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5); // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  var id = [schema, dateUTC, secondsUTC, millisecs, rand].join('.');
  // log('_id', id);
  return id;
}


// returns milliseconds from 1/1/1970 preadjusted to UTC
var getTimeUTC = function() {
  var now = new Date();
  var nowUTC = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return nowUTC.getTime();
}


// choke point to tork the generic output later if we want
function serialize(doc) {
  return doc.toObject();
}


// Experimental:  convert the monogodb driver's ObjectId to a more compact representation
function tiny(oid, alphabet) {
  var oid = oid || new mongoose.Types.ObjectId();
  var alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var tinyId = '';
  var num = parseInt(oid, 16);  // broken: this looses precision, leading to collisions
  log(oid);
  log(num.toString(16));
  var radix = alphabet.length;
  while (num > 0) {
    var remainder = num % radix;
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix;
  }
  return tinyId;
}


