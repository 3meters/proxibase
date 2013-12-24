/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var entity = require('./_entity')
var sPost = util.statics.schemas.post

var post = {

  id: sPost.id,
  name: sPost.name,
  collection: sPost.collection,

  fields: {
    _place:   { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, post)
}
