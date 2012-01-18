
/*
 * Base Schema inherited by all Models
 */

var Schema = require('mongoose').Schema;

var baseSchema = module.exports = new Schema({
  _id:        { type: String, default: genId },
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

/*
 * Index is the schema number.  It is intended to be overridden by each model that relies 
 * on the base schema to generate IDs, it should be a int between 0 and 999 that will be 
 * padded to 3 digits in the id.  It should be unique per schema per database, but that is 
 * optional and is up to the developer to ensure
 */
baseSchema.index = 0;

// pad a a number to a fixed-lengh string with leading zeros -- helps make ids regular and sortable
function pad(n, digits) {
  n = n.toString();
  digits = digits || 3;
  if (n.length > digits)
    throw new Error('Invalid seed sent to genId: ' + n + ' expected ' + digits + ' or less');
  var i = digits - n.length, zeros = '';
  while (i--) {
    zeros += '0';
  }
  return zeros + n;
}

/*
 * genId: create a string with this format:
 *    idx.yymmdd.hhmmss.mil.rand
 */
function genId() {
  var index = pad(baseSchema.index, 3); // collection index, max 999
  var now = new Date();
  var year = pad((now.getUTCFullYear() - 2000), 2);
  var month = pad((now.getUTCMonth() + 1), 2);
  var day = pad((now.getUTCDate()), 2);
  var hour = pad((now.getUTCHours()), 2);
  var minute =  pad((now.getUTCMinutes()), 2);
  var second = pad((now.getUTCSeconds()), 2);
  var mil = pad((now.getUTCMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 10000)), 4);
  var day = year + month + day;
  var second = hour + minute + second;
  return [index, day, second, mil, rand].join('.');
}

function serialize(doc) {
  doc = doc.toObject({ getters: true });
  delete doc._id;
  return doc;
}

