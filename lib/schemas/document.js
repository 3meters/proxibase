/**
 *  Documents schema
 */

var mongo = require('../db')
var base = require('./_base')
var sDocument = util.statics.schemas.document

var document = {
  id: sDocument.id,
  name: sDocument.name,
  collection: sDocument.collection,
  owerAccess: true,
}

exports.getSchema = function() {
  return mongo.createSchema(base, document)
}
