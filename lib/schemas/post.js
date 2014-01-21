/**
 *  Post schema, bascially a raw entity
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sPost = statics.schemas.post

var post = {
  id: sPost.id,
  name: sPost.name,
  collection: sPost.collection,
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, post)
}
