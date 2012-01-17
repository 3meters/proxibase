
/*
 * Base Schema inherited by all Models
 */

var Schema = require('mongoose').Schema;
var ObjectId = Schema.ObjectId;

var baseSchema = module.exports = new Schema({
  owner:      { type: ObjectId },
  created:    { type: Number, default: now },
  createdBy:  { type: ObjectId },
  changed:    { type: Number, default: now },
  changedBy:  { type: ObjectId }
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

function now() {
  return Date.now();
}

function serialize(doc) {
  doc = doc.toObject({ getters: true });
  delete doc._id;
  return doc;
}

