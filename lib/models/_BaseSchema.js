
/*
 * Base Schema inherited by all Models
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var baseSchema = module.exports = new Schema({ 
  _id:        { type: String, default: genId},
  name:       { type: String, required: true },
  owner:      { type: String },
  created:    { type: Number, default: Date.now },
  createdBy:  { type: String },
  changed:    { type: Number, default: Date.now },
  changedBy:  { type: String }
});


// Should be overridden by each model. There's probably a cleaner way to do this
baseSchema.schemaId = 0;


/*
 * genId: create a mongodb _id of type String
 *
 *  Ids are ascci strings composed of digits and dots that
 *    increase over time
 *    collide infrequently under load
 *    sort reasonably
 *    can read easily by humans
 *
 *  Id elements
 *    clusterId.schemaId.date.secondsSinceMidnight.milliseconds.randomNumber
 *
 *  Id digits
 *    cls.sch.yymmdd.scnds.mil.random
 *
 */
function genId() {

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

  // clusterId: integer 0-999, reserved for future use
  var cluster = '000';

  // collectionId, integer 0-999
  if (!baseSchema.schemaId)
    throw new Error('schema.schemaId is required.  Set it to a unique integer for each schema in your database');
  var schema = pad(baseSchema.schemaId, 3);

  // UTC date, YYMMDD
  var now = new Date();
  var year = pad((now.getUTCFullYear() - 2000), 2);  // start from 2000
  var month = pad((now.getUTCMonth() + 1), 2); // read Jan as 01, not 00
  var day = pad((now.getUTCDate()), 2);
  var date = year + month + day; 

  // seconds since midnight today, UTC
  var localOffset = now.getTimezoneOffset() * 60000; // getTimezoneOffset returns minutes
  var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var seconds = pad(Math.floor((now.getTime() - midnight.getTime() - localOffset) / 1000), 5); // max 86400

  var millisecs = pad((now.getUTCMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  return [cluster, schema, date, seconds, millisecs, rand].join('.');
}

baseSchema.statics = {
  serialize: function(doc) {
    doc = doc.toObject({ getters: true });
    delete doc._id;
    return doc;
  }
}

