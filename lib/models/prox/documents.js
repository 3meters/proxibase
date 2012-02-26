/*
 *  Documents model
 */

var Schema = require('../base').Schema;
var Documents = new Schema(5);
var log = require('../../util').log;

Documents.add({
  type:        { type: String, index: true }
});

exports.getSchema = function() {
  return Documents;
}
