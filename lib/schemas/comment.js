/**
 *  Comments schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sComment = statics.schemas.comment

var comment = {

  id: sComment.id,
  name: sComment.name,
  collection: sComment.collection,
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, comment)
}
