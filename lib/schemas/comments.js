/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')

var comment = { 
  
  id: util.statics.collectionIds.comments,

  fields: {
    _place:   { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, comment)
}
