/**
 *  Documents schema
 */

var mongo = require('../db')
var base = require('./_base')

var document = { id: util.statics.collectionIds.documents }

exports.getSchema = function() {
  return mongo.createSchema(base, document)
}
