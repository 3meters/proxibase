
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


baseSchema.statics = {
  index: function(cb) {
    this.find()
      .fields()
      .limit(1000)
      .run(function (err, docs) {
        docs.forEach(function(doc, i) {
          docs[i] = serialize(doc);
        });
        return cb(err, docs);
      });
  }
};


// Experimental:  convert the monogodb driver's objectID to a more compact representation
function tiny() {
  var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var oid = new mongoose.Types.ObjectId();
  console.log(oid);
  var num = parseInt(oid, 16);  // broken: this looses precision, leading to collisions
  console.log(num.toString(16));
  var radix = alphabet.length;
  var tinyId = '';
  while (num > 0) {
    var remainder = num % radix;
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix;
  }
  return tinyId;
}


/*
 * Index is the schema number.  It is intended to be overridden by each model that relies 
 * on the base schema to generate IDs, it should be a int between 0 and 999 that will be 
 * padded to 3 digits in the id.  It should be unique per schema per database, but that is 
 * optional and is up to the developer to ensure
 */
baseSchema.index = 0;


/*
 * genId: create a mongodb _id of type String
 *
 *  _ids should increase over time, have few collisions under load, sort reasonably, and be human readable
 *
 *  They are of the form: 
 *
 *    collectionIndex.date.secondsSinceMidnight.milliseconds.randomNumber
 *
 *  in the following format with a fixed number of characters for each element:
 *
 *    idx.yymmdd.scnds.mil.random
 *
 */
function genId() {

  // pad a number to a fixed-lengh string with leading zeros
  function pad(n, digits) {
    var s = n.toString();
    if (s.indexOf('-') >= 0 || s.indexOf('.') >= 0 || s.length > digits)
      throw new Error('Invalid id seed: ' + s);
    for (var i = digits - s.length, zeros = ''; i-- ;) {
      zeros += '0';
    }
    return zeros + s;
  }

  // collection index, integer 0-999
  if (!baseSchema.index) console.log('Warning: collection index not set.  Defauting to 0');
  var index = pad(baseSchema.index, 3);

  var now = new Date();
  var year = pad((now.getUTCFullYear() - 2000), 2);  // start from 2000
  var month = pad((now.getUTCMonth() + 1), 2); // read Jan as 01, not 00
  var day = pad((now.getUTCDate()), 2);

  // seconds since midnight today, UTC
  var localOffset = now.getTimezoneOffset() * 60000; // getTimezoneOffset returns minutes
  var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var seconds = pad(Math.floor((now.getTime() - midnight.getTime() - localOffset) / 1000), 5); // max 86400

  var millisecs = pad((now.getUTCMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)
  day = year + month + day; // yymmdd

  return [index, day, seconds, millisecs, rand].join('.');
}

function serialize(doc) {
  doc = doc.toObject({ getters: true });
  delete doc._id;
  return doc;
}

