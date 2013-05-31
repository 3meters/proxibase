/**
 *  Documents schema
 */

var mongo = require('../db')
var base = require('./_base')

var document = {
  collection: {
    id: '0007',
    name: 'documents',
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, document)
}