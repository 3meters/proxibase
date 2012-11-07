/**
 *  Documents schema
 */

var util = require('util')
var mongodb = require('mongodb')
var documents = Object.create(mongodb.schema)

documents.id = util.statics.collectionIds.documents

exports._getSchema = function() {
  return documents
}
