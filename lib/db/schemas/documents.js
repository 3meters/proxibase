/**
 *  Documents schema
 */

var util = require('util')
var mongo = require('..')
var base = require('./_base').get()
var documents = {}

documents.id = util.statics.collectionIds.documents

exports.getSchema = function() {
  return mongo.createSchema(base, documents)
}
