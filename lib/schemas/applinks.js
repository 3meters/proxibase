/**
 *  Applinks schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var applink = {

  id: '0010',

  fields: {
    id:       { type: 'string' },
    url:      { type: 'string' },
    position: { type: 'number' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, applink)
}
