/**
 *  Applinks schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var applink = {

  collection: {
    id: '0203',
    name: 'com.aircandi.entity.applinks',
  },

  fields: {
    applink:  { type: 'object', value: {
      type:     { type: 'string' },
      id:       { type: 'string' },
      url:      { type: 'string' },
      data:     { type: 'object' },
    }},
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, applink)
}
