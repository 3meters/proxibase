/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var comment = { id: util.statics.collectionIds.comments }

exports.getSchema = function() {
  return mongo.createSchema(base, entity, comment)
}
