/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var comment = { 
  collection: {
    id: '0205',
    name: 'com.aircandi.entity.comments',
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, comment)
}