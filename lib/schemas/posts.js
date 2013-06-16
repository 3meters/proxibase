/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var post = { id: util.statics.collectionIds.posts }

exports.getSchema = function() {
  return mongo.createSchema(base, entity, post)
}
