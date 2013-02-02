/**
 *  Documents schema
 */

var util = require('utils')
var mongo = require('..')
var base = require('./_base')
var documents = {}

documents.id = util.statics.collectionIds.documents

exports.getSchema = function() {
  return mongo.createSchema(base, documents)
}
