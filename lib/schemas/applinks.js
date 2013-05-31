/**
 *  Applinks schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')

var applink = {

  id: '0010',

  fields: {
    id:       { type: 'string' },
    url:      { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, applink)
}
