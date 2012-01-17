
/*
 * Base Schema inherited by all Models
 */

var Schema = require('mongoose').Schema;
var schema = new Schema({});

schema.exists = function(v) {
  return v && v.length;
}

schema.statics.index = function(cb) {
  this.find()
    .fields()
    .limit(1000)
    .run(function (err, docs) {
      var fullDocs = [];
      docs.forEach(function(doc) {
        var myDoc = doc.toObject({getters: true});
        myDoc.createdDate = new Date(myDoc.created);
        delete myDoc._id;
        fullDocs.push(myDoc);
      });
      return cb(err, fullDocs);
    });
};

module.exports = schema;

