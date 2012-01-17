
/*
 * Base Schema inherited by all Models
 */

var Schema = require('mongoose').Schema;
var ObjectId = Schema.ObjectId;

var baseSchema = new Schema({
  owner:      { type: ObjectId },
  created:    { type: Number, default: now() },
  createdBy:  { type: ObjectId },
  changed:    { type: Number, default: now() },
  changedBy:  { type: ObjectId }
});

baseSchema.statics = {

  index: function(cb) {
    var query = this.find();
    query
      .fields()
      .limit(1000)
      .run(function (err, docs) {
        var fullDocs = [];
        docs.forEach(function(doc) {
          var myDoc = doc.toObject({getters: true});
          // delete doc._id;
          fullDocs.push(myDoc);
        });
        return cb(err, fullDocs);
      });
  }
};

function now() {
  return Date.now();
}

module.exports = baseSchema;

