/*
 *  Documents model
 */

var Schema = require('./_base').Schema;
var Documents = new Schema(6);
var log = require('../log');

Documents.add({
  type:        { type: String, index: true }
});

exports.getSchema = function() {
  return Documents;
}