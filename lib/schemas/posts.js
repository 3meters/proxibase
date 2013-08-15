/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var entity = require('./_entity')

var post = { 

  id: util.statics.collectionIds.posts, 
  
  fields: {
    _place:   { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, post)
}
