/**
 *  Comments schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sComment = util.statics.schemas.comment

var comment = {

  id: sComment.id,
  name: sComment.name,
  collection: sComment.collection,

  fields: {
    _place:   { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, comment)
}
