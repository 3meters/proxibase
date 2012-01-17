
/*
 * Base Schema inherited by all Models
 */

var Schema = require('mongoose').Schema;
var schema = new Schema({});

schema.statics.index = function(cb) {
  var query = this.find();
  query
    .fields()
    .limit(1000)
    .run(function (err, docs) {
      var fullDocs = [];
      docs.forEach(function(doc) {
        var myDoc = doc.toObject({getters: false});
        delete myDoc._id;
        console.dir(myDoc);
        fullDocs.push(myDoc);
      });
      return cb(err, fullDocs);
    });
};

module.exports = schema;

