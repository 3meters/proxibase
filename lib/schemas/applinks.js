/**
 *  Applinks schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')

var applink = {

  id: util.statics.collectionIds.applinks,

  fields: {
    appId:       { type: 'string' },
    appUrl:      { type: 'string' },
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, applink)
}
