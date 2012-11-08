/**
 *  Documents schema
 */

var util = require('util')
var mongodb = require('mongodb')
var base = require('./_base').get()
var documents = mongodb.createSchema()

documents.id = util.statics.collectionIds.documents

exports.getSchema = function() {
  return mongodb.createSchema(base, documents)
}
