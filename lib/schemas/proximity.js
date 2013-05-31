/**
 *  links.proximity schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var link = require('./_link')

var proximity = {

  collection: {
    id: '0102',
    name: 'com.aircandi.link.proximity',
  },

  fields: {
    proximity:          { type: 'object', value: {
      primary:            { type: 'boolean' }, 
      signal:             { type: 'number' },
    }},
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, link, proximity)
}