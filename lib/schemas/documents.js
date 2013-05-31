/**
 *  Documents schema
 */

var mongo = require('../db')
var base = require('./_base')

var document = { id: '0007' }

exports.getSchema = function() {
  return mongo.createSchema(base, document)
}